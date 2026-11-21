import clsx from "clsx";
import {
  Boxes,
  Package,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { useAccounts } from "../hooks/useAccounts";

export type Screen = "instances" | "mods" | "profile" | "settings";

interface NavItem {
  id: Screen;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { id: "instances", label: "Инстансы", icon: Boxes },
  { id: "mods", label: "Моды", icon: Package },
  { id: "profile", label: "Профиль", icon: UserRound },
];

interface SidebarProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function Sidebar({ screen, onNavigate }: SidebarProps) {
  const { data } = useAccounts();
  const account =
    data?.accounts.find((item) => item.id === data.activeId) ??
    data?.accounts[0] ??
    null;
  const skin =
    account?.skins.find((item) => item.state === "ACTIVE") ??
    account?.skins[0] ??
    null;

  return (
    <nav className="flex w-[216px] shrink-0 flex-col px-3 pb-3 pt-4">
      <button
        type="button"
        onClick={() => onNavigate("instances")}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-100 hover:bg-white/[0.05]"
      >
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          className="h-8 w-8 shrink-0 rounded-lg object-contain"
        />
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold tracking-tight text-white">
            rclaunch
          </span>
          <span className="block truncate text-[10px] text-faint">
            Minecraft launcher
          </span>
        </span>
      </button>

      <div className="mt-7 px-2">
        <span className="section-label">Библиотека</span>
      </div>

      <div className="mt-2 flex flex-col gap-0.5">
        {items.map((item) => (
          <SidebarButton
            key={item.id}
            item={item}
            active={screen === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className={clsx(
            "glass-card glass-card-hover flex items-center gap-2.5 rounded-xl px-2 py-2 text-left",
            screen === "profile" && "border-white/[0.14] bg-white/[0.08]",
          )}
        >
          {skin?.url ? (
            <span
              className="h-7 w-7 shrink-0 rounded-md bg-white/[0.06]"
              style={{
                backgroundImage: `url(${skin.url})`,
                backgroundSize: "224px 224px",
                backgroundPosition: "-28px -28px",
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
              }}
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07] text-muted">
              <UserRound size={14} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium text-white">
              {account?.name ?? "Гость"}
            </span>
            <span className="block truncate text-[10px] text-faint">
              {account ? "Активный аккаунт" : "Войти через Microsoft"}
            </span>
          </span>
          <span
            className={clsx(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              account ? "bg-emerald-400/90" : "bg-white/20",
            )}
          />
        </button>

        <div className="hairline" />

        <SidebarButton
          item={{ id: "settings", label: "Настройки", icon: Settings }}
          active={screen === "settings"}
          onClick={() => onNavigate("settings")}
        />
      </div>
    </nav>
  );
}

function SidebarButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      title={item.label}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={clsx(
        "flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[12.5px] transition-colors duration-100",
        active
          ? "bg-white/[0.11] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "text-muted hover:bg-white/[0.05] hover:text-white",
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        className={active ? "text-accent-400" : "text-current opacity-80"}
      />
      <span className="truncate">{item.label}</span>
    </button>
  );
}
