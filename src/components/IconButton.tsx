import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "danger";
}

export function IconButton({
  icon: Icon,
  label,
  size = "md",
  variant = "ghost",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-35",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        variant === "ghost" && "text-muted hover:bg-white/[0.06] hover:text-white",
        variant === "danger" && "text-muted hover:bg-red-500/10 hover:text-red-400",
        className,
      )}
      {...rest}
    >
      <Icon size={size === "sm" ? 14 : 16} strokeWidth={1.8} />
    </button>
  );
}
