import { cn } from "@/lib/utils";

const stroke = "#0B0B0F";
const primary = "#FD4646";
const soft = "#F4F4F7";

export function SuccessIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 180"
      role="img"
      aria-label="Order confirmed"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="158" rx="76" ry="10" fill={soft} />
      <circle cx="110" cy="82" r="56" fill="#FFF1F1" />
      <path
        d="M84 84.5 103 103l35-38"
        fill="none"
        stroke={primary}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="110" cy="82" r="56" fill="none" stroke={primary} strokeWidth="3" strokeDasharray="6 10" opacity="0.5" />
      <circle cx="40" cy="42" r="5" fill={primary} opacity="0.6" />
      <circle cx="186" cy="60" r="4" fill={stroke} opacity="0.25" />
      <circle cx="172" cy="26" r="6" fill="#FFC5C5" />
      <rect x="28" y="96" width="10" height="10" rx="3" fill="#FFC5C5" />
    </svg>
  );
}

export function NotFoundIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 180"
      role="img"
      aria-label="Page not found"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="130" cy="160" rx="92" ry="11" fill={soft} />
      <rect x="36" y="30" width="188" height="112" rx="16" fill="#FFFFFF" stroke={stroke} strokeWidth="3" />
      <rect x="36" y="30" width="188" height="26" rx="16" fill={soft} />
      <circle cx="54" cy="43" r="4" fill={primary} />
      <circle cx="68" cy="43" r="4" fill="#E5E5EA" />
      <circle cx="82" cy="43" r="4" fill="#E5E5EA" />
      <text
        x="130"
        y="112"
        textAnchor="middle"
        fontSize="46"
        fontWeight="700"
        fill={stroke}
        letterSpacing="-2"
      >
        404
      </text>
      <path d="M100 124h60" stroke="#E5E5EA" strokeWidth="6" strokeLinecap="round" />
      <circle cx="222" cy="126" r="20" fill="#FFF1F1" stroke={primary} strokeWidth="3" />
      <path d="M236 140l12 12" stroke={primary} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 180"
      role="img"
      aria-label="Something went wrong"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="158" rx="76" ry="10" fill={soft} />
      <path
        d="M110 26 178 132H42L110 26Z"
        fill="#FFF1F1"
        stroke={primary}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M110 62v38" stroke={primary} strokeWidth="8" strokeLinecap="round" />
      <circle cx="110" cy="116" r="5.5" fill={primary} />
      <circle cx="34" cy="46" r="5" fill="#FFC5C5" />
      <circle cx="190" cy="60" r="4" fill={stroke} opacity="0.2" />
    </svg>
  );
}

export function EmptyBoxIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="Nothing here yet"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="150" rx="70" ry="9" fill={soft} />
      <path d="M42 66h136v66a8 8 0 0 1-8 8H50a8 8 0 0 1-8-8V66Z" fill="#FFFFFF" stroke={stroke} strokeWidth="3" />
      <path d="M32 44h156v24H32z" fill={soft} stroke={stroke} strokeWidth="3" />
      <path d="M92 68h36" stroke={primary} strokeWidth="6" strokeLinecap="round" />
      <path d="M74 32 92 44M146 32l-18 12" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

export function EmptyCartIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="Your cart is empty"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="152" rx="72" ry="9" fill={soft} />
      <path
        d="M40 42h20l14 62h78l16-46H74"
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="86" cy="126" r="10" fill="#FFF1F1" stroke={primary} strokeWidth="4" />
      <circle cx="146" cy="126" r="10" fill="#FFF1F1" stroke={primary} strokeWidth="4" />
      <circle cx="168" cy="42" r="16" fill="#FFF1F1" />
      <path d="M162 42h12M168 36v12" stroke={primary} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyHeartIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="Your wishlist is empty"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="150" rx="66" ry="9" fill={soft} />
      <path
        d="M110 132S54 100 54 68a28 28 0 0 1 56-8 28 28 0 0 1 56 8c0 32-56 64-56 64Z"
        fill="#FFFFFF"
        stroke={primary}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M92 62a18 18 0 0 1 14-8" stroke="#FFC5C5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function NoResultsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="No results found"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="150" rx="66" ry="9" fill={soft} />
      <circle cx="98" cy="72" r="42" fill="#FFFFFF" stroke={stroke} strokeWidth="4" />
      <circle cx="98" cy="72" r="26" fill={soft} />
      <path d="M130 104l28 28" stroke={primary} strokeWidth="8" strokeLinecap="round" />
      <path d="M86 62l24 24M110 62l-24 24" stroke={primary} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function NoBellIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="No notifications"
      className={cn("h-auto w-full", className)}
    >
      <ellipse cx="110" cy="150" rx="60" ry="9" fill={soft} />
      <path
        d="M110 30a30 30 0 0 1 30 30v26l12 18H68l12-18V60a30 30 0 0 1 30-30Z"
        fill="#FFFFFF"
        stroke={stroke}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M98 116a12 12 0 0 0 24 0" stroke={primary} strokeWidth="4" strokeLinecap="round" />
      <path d="M110 22v8" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <circle cx="152" cy="44" r="10" fill="#FFF1F1" stroke={primary} strokeWidth="3" />
    </svg>
  );
}

export function MapPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-soft",
        className,
      )}
    >
      <svg viewBox="0 0 600 280" className="h-full w-full" aria-hidden>
        <rect width="600" height="280" fill="#F7F7F9" />
        <g stroke="#E7E7EE" strokeWidth="2">
          <path d="M0 60h600M0 130h600M0 200h600M90 0v280M220 0v280M350 0v280M470 0v280" />
        </g>
        <path d="M-20 210 C120 150 200 250 320 170 C420 105 520 150 620 100" fill="none" stroke="#DCDCE6" strokeWidth="14" strokeLinecap="round" />
        <path d="M-20 210 C120 150 200 250 320 170 C420 105 520 150 620 100" fill="none" stroke="#FD4646" strokeWidth="4" strokeDasharray="10 12" strokeLinecap="round" />
        <circle cx="120" cy="176" r="9" fill="#0B0B0F" />
        <circle cx="120" cy="176" r="18" fill="none" stroke="#0B0B0F" strokeWidth="2" opacity="0.25" />
        <g>
          <circle cx="470" cy="126" r="16" fill="#FD4646" />
          <circle cx="470" cy="126" r="6" fill="#FFFFFF" />
          <circle cx="470" cy="126" r="30" fill="none" stroke="#FD4646" strokeWidth="2" opacity="0.35" />
        </g>
        <rect x="24" y="24" width="132" height="34" rx="12" fill="#FFFFFF" />
        <text x="40" y="46" fontSize="14" fill="#6B7280">
          Live map preview
        </text>
      </svg>
    </div>
  );
}
