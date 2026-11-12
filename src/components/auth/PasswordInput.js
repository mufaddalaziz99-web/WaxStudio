'use client';
import { useState } from 'react';

export default function PasswordInput({ id, value, onChange, autoComplete = 'current-password', invalid, placeholder, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={show ? 'text' : 'password'}
        className={`input pr-16 ${invalid ? 'input-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        aria-invalid={invalid || undefined}
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-2 my-auto h-8 rounded-full px-3 text-xs font-semibold text-ink-soft hover:bg-ink/5"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
