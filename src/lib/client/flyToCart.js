'use client';
/** Fly-to-cart animation: clones a small dot from `fromEl` to the header cart button. */
export function flyToCart(fromEl, imageSrc) {
  try {
    const target = document.querySelector('[data-cart-target]');
    if (!fromEl || !target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.dispatchEvent(new Event('cart:fly'));
      return;
    }
    const a = fromEl.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const size = 56;
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', zIndex: 80, left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px`,
      width: `${size}px`, height: `${size}px`, borderRadius: '999px', pointerEvents: 'none',
      background: imageSrc ? `center/cover no-repeat url("${imageSrc}") #f9edd6` : '#d6852a',
      boxShadow: '0 6px 20px rgba(0,0,0,.2)', transition: 'transform .7s cubic-bezier(.5,-.3,.7,1), opacity .7s',
    });
    document.body.appendChild(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
      el.style.opacity = '0.6';
    });
    setTimeout(() => {
      el.remove();
      window.dispatchEvent(new Event('cart:fly'));
    }, 720);
  } catch {
    window.dispatchEvent(new Event('cart:fly'));
  }
}
