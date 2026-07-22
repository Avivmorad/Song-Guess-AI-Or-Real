import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      {children}
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </IconBase>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 8 4 4 4-7 4 7 4-4-2 10H6L4 8Z" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  );
}

export function VolumeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 10H3v4h3l4 3V7l-4 3Z" />
      <path d="M14 9a4 4 0 0 1 0 6M17 6a8 8 0 0 1 0 12" />
    </IconBase>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </IconBase>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z" />
    </IconBase>
  );
}
