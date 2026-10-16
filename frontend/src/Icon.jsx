// Íconos de trazo propio (24×24, trazo 1.8, extremos redondeados), en reemplazo de los emojis:
// un emoji se ve distinto en cada sistema operativo y no hereda el color del texto.
const PATHS = {
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>,
  gps: <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.8 2.8L16.5 9.4" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  car: <><path d="M5 16v2.5M19 16v2.5M3.5 16h17v-4l-2-5h-13l-2 5z" /><path d="M3.5 12h17" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2c1.5.4 2.6.9 2.6 2.1s-1.1 1.9-2.6 1.9c-1.2 0-2.1-.5-2.6-1.3M12 6.5V8M12 16v1.5" /></>,
  nav: <path d="M4 11.5 20 4l-7.5 16-2-6.5z" />,
  route: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  ticket: <><path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z" /><path d="M14 6v12" strokeDasharray="1.5 2.5" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  printer: <><path d="M7 9V4h10v5M7 17H4v-7h16v7h-3" /><path d="M7 14h10v6H7z" /></>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>,
  users: <><circle cx="9" cy="8.5" r="3.4" /><path d="M2.5 19.5c1-3.2 3.5-4.9 6.5-4.9s5.5 1.7 6.5 4.9M15.5 5.3a3.4 3.4 0 0 1 0 6.4M17.5 14.8c2 .6 3.3 2.2 4 4.7" /></>,
  building: <><path d="M4 20V5l8-2v17M12 9h8v11" /><path d="M7.5 8h1.5M7.5 12h1.5M7.5 16h1.5M15.5 13h1.5M15.5 17h1.5M2.5 20h19" /></>,
  sliders: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />,
  clipboard: <><path d="M9 4h6v3H9z" /><path d="M9 5.5H6v15h12v-15h-3M9 12h6M9 16h4" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4.5l3 1.8" /></>,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  refresh: <><path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9" /><path d="M18 3.5v4h-4M6 20.5v-4h4" /></>,
  chat: <path d="M4.5 5.5h15v10h-8.5l-4.5 4v-4h-2z" />,
  card: <><rect x="3" y="6" width="18" height="12" rx="1.5" /><path d="M3 10h18M6.5 14.5h4" /></>,
  cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="1" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>,
  chart: <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />,
  logout: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.1" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 7 8.5-7" /></>
};

export default function Icon({ name, size = 18, className = '', title }) {
  return (
    <svg
      className={'icon ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

// Letrero de estacionamiento (la "E" blanca sobre azul de la señalética vial chilena): es la
// marca del sitio, no un ícono decorativo.
export function SignE({ size = 30 }) {
  return <span className="sign-e" style={{ '--sign-size': `${size}px` }} aria-hidden="true">E</span>;
}
