import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export const IconLeaf = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 21c0-9 5-15 15-16-1 10-7 15-15 16z" /><path d="M5 21l8-8" /></svg>
);
export const IconHome = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3 2.4 3 5" /></svg>
);
export const IconUserPlus = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" /><path d="M19 8v6M16 11h6" /></svg>
);
export const IconCamera = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);
export const IconQr = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18v2M18 14h2" /></svg>
);
export const IconBell = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg>
);
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" /></svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></svg>
);
export const IconChevron = (p: IconProps) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconBack = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></svg>
);
export const IconStethoscope = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v3a4 4 0 0 0 8 0v-2" /><circle cx="18" cy="12" r="2" /></svg>
);
export const IconCalendar = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
