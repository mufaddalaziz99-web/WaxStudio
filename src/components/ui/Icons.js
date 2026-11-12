// Small inline icon set (stroke icons, currentColor).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const BagIcon = (p) => (<svg {...base} {...p}><path d="M6 7h12l-1 13H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>);
export const HeartIcon = ({ filled, ...p }) => (<svg {...base} fill={filled ? 'currentColor' : 'none'} {...p}><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z" /></svg>);
export const UserIcon = (p) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
export const SearchIcon = (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
export const SparkIcon = (p) => (<svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></svg>);
export const DropIcon = (p) => (<svg {...base} {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /><path d="M4 4l16 16" /></svg>);
export const ClockIcon = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const FeatherIcon = (p) => (<svg {...base} {...p}><path d="M20 4c-8 0-14 6-14 14v2h2c8 0 14-6 14-14V4z" /><path d="M4 20L14 10" /></svg>);
export const ShareIcon = (p) => (<svg {...base} {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></svg>);
export const TagIcon = (p) => (<svg {...base} {...p}><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>);
export const CashIcon = (p) => (<svg {...base} {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>);
export const MenuIcon =(p) => (<svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const CloseIcon = (p) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const MinusIcon = (p) => (<svg {...base} width={16} height={16} {...p}><path d="M5 12h14" /></svg>);
export const PlusIcon = (p) => (<svg {...base} width={16} height={16} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const TrashIcon = (p) => (<svg {...base} width={18} height={18} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>);
export const TruckIcon = (p) => (<svg {...base} {...p}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>);
export const ShieldIcon = (p) => (<svg {...base} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>);
export const ReturnIcon = (p) => (<svg {...base} {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>);
export const LeafIcon = (p) => (<svg {...base} {...p}><path d="M5 19c9 0 14-6 14-15C10 4 5 9 5 19z" /><path d="M5 19l7-7" /></svg>);
export const CheckIcon = (p) => (<svg {...base} {...p}><path d="M5 12l5 5 9-10" /></svg>);
export const StarIcon = ({ fill = 1, size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
    <defs>
      <linearGradient id={`sg${Math.round(fill * 100)}`}>
        <stop offset={`${fill * 100}%`} stopColor="#141414" />
        <stop offset={`${fill * 100}%`} stopColor="#dcd6cb" />
      </linearGradient>
    </defs>
    <path fill={`url(#sg${Math.round(fill * 100)})`} d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
  </svg>
);
export const WhatsAppIcon = (p) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.3-.3-.3-.6-.5z" />
  </svg>
);
