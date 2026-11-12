'use client';
import { useRef } from 'react';

/** Six single-digit boxes that behave like one field (typing, backspace, arrows and paste all work). */
export default function CodeInput({ value, onChange, onComplete, disabled, invalid, autoFocus = true }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  function commit(next) {
    const clean = next.replace(/\D/g, '').slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  }

  function onInput(i, raw) {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    const arr = [...digits];
    if (typed.length > 1) {
      // Paste or SMS/email autofill into one box: spread from this position.
      const clean = commit((value.slice(0, i) + typed).slice(0, 6));
      refs.current[Math.min(clean.length, 5)]?.focus();
      return;
    }
    arr[i] = typed;
    const clean = commit(arr.join(''));
    refs.current[Math.min(i + 1, 5)]?.focus();
    if (clean.length === 6) refs.current[5]?.blur();
  }

  function onKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = [...digits];
      if (arr[i]) {
        arr[i] = '';
      } else if (i > 0) {
        arr[i - 1] = '';
        refs.current[i - 1]?.focus();
      }
      onChange(arr.join('').slice(0, 6));
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={i === 0 ? 6 : 1}
          aria-label={`Digit ${i + 1}`}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          value={d}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => {
            if (i > value.length) refs.current[value.length]?.focus();
            else e.target.select();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const clean = commit(e.clipboardData.getData('text'));
            refs.current[Math.min(clean.length, 5)]?.focus();
          }}
          className={`h-14 w-full min-w-0 rounded-xl border bg-white text-center text-2xl font-semibold text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-brand-200 sm:h-16 ${
            invalid ? 'border-red-400' : 'border-ink/15'
          }`}
        />
      ))}
    </div>
  );
}
