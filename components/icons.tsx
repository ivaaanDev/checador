import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function MarkIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /><path d="M5 4.5 3.5 6" /></Icon>
}

export function HomeIcon(props: IconProps) {
  return <Icon {...props}><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /><path d="M9 20v-6h6v6" /></Icon>
}

export function UsersIcon(props: IconProps) {
  return <Icon {...props}><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20" /><circle cx="9.5" cy="7" r="3" /><path d="M17 4.2a3 3 0 0 1 0 5.7M21 20v-1.5a4.5 4.5 0 0 0-3.4-4.4" /></Icon>
}

export function MonitorIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></Icon>
}

export function ClockIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Icon>
}

export function AdjustIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></Icon>
}

export function LogOutIcon(props: IconProps) {
  return <Icon {...props}><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /></Icon>
}

export function ArrowUpRightIcon(props: IconProps) {
  return <Icon {...props}><path d="M7 17 17 7M8 7h9v9" /></Icon>
}

export function ArrowLeftIcon(props: IconProps) {
  return <Icon {...props}><path d="m10 5-7 7 7 7M3 12h18" /></Icon>
}

export function PlusIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>
}

export function CameraIcon(props: IconProps) {
  return <Icon {...props}><path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12.5" r="4" /></Icon>
}

export function CheckIcon(props: IconProps) {
  return <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
}

export function AlertIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 3 2.7 19a1.2 1.2 0 0 0 1 1.8h16.6a1.2 1.2 0 0 0 1-1.8Z" /><path d="M12 9v4M12 17h.01" /></Icon>
}

export function RefreshIcon(props: IconProps) {
  return <Icon {...props}><path d="M20 7v5h-5" /><path d="M4.9 17A8 8 0 0 0 20 12M4 12a8 8 0 0 1 15.1-5" /><path d="M4 7v5h5" /></Icon>
}

export function ChevronRightIcon(props: IconProps) {
  return <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>
}

export function LockIcon(props: IconProps) {
  return <Icon {...props}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
}

export function BuildingIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M17 9h3v12M8 7h1M12 7h1M8 11h1M12 11h1M8 15h1M12 15h1M2 21h20" /></Icon>
}
