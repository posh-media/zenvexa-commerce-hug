type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {children}
    </svg>
  );
}

export function XMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M17.53 3H20l-5.86 6.7L21 21h-5.9l-4.16-5.6L6.1 21H3.6l6.2-7.08L3 3h5.9l3.9 5.25L17.53 3Zm-1.03 16.2h1.42L7.6 4.72H6.08L16.5 19.2Z" />
    </Svg>
  );
}

export function InstagramMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M7.8 3h8.4A4.8 4.8 0 0 1 21 7.8v8.4A4.8 4.8 0 0 1 16.2 21H7.8A4.8 4.8 0 0 1 3 16.2V7.8A4.8 4.8 0 0 1 7.8 3Zm0 1.8A3 3 0 0 0 4.8 7.8v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm8.85 1.35a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1ZM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 1.8a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z"
      />
    </Svg>
  );
}

export function FacebookMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M13.5 21v-7.2h2.45l.37-2.85H13.5V9.13c0-.82.23-1.38 1.4-1.38h1.5V5.2A20 20 0 0 0 14.22 5c-2.17 0-3.66 1.32-3.66 3.76v2.19H8.1v2.85h2.46V21h2.94Z" />
    </Svg>
  );
}

export function YoutubeMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21.3 7.9a2.5 2.5 0 0 0-1.75-1.77C17.98 5.7 12 5.7 12 5.7s-5.98 0-7.55.43A2.5 2.5 0 0 0 2.7 7.9C2.28 9.5 2.28 12 2.28 12s0 2.5.42 4.1a2.5 2.5 0 0 0 1.75 1.77C6.02 18.3 12 18.3 12 18.3s5.98 0 7.55-.43a2.5 2.5 0 0 0 1.75-1.77c.42-1.6.42-4.1.42-4.1s0-2.5-.42-4.1ZM10.2 15.1V8.9L15.3 12l-5.1 3.1Z" />
    </Svg>
  );
}

export function LinkedinMark({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6.94 8.4H4V21h2.94V8.4ZM5.47 3a1.74 1.74 0 1 0 0 3.48 1.74 1.74 0 0 0 0-3.48ZM20 14.13c0-3.2-1.7-4.7-3.98-4.7-1.83 0-2.65 1-3.1 1.72V8.4H9.98V21h2.94v-6.7c0-1.42.6-2.28 1.83-2.28 1.16 0 1.72.8 1.72 2.28V21H20v-6.87Z" />
    </Svg>
  );
}
