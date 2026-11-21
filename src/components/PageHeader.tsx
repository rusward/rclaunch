import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="shrink-0 px-7 pb-4 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-[11.5px] text-faint">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
