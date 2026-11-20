import clsx from "clsx";
import {
  Boxes,
  Package,
  Settings,
  Shirt,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type Screen = "instances" | "mods" | "account" | "skins" | "settings";

interface NavItem {
  id: Screen;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { id: "instances", label: "Инстансы", icon: Boxes },
  { id: "mods", label: "Моды", icon: Package },
  { id: "account", label: "Аккаунт", icon: UserRound },
  { id: "skins", label: "Скины", icon: Shirt },
];

interface RailProps {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function Rail({ screen, onNavigate }: RailProps) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center border-r border-line py-3">
      <button
        type="button"
        title="rclaunch"
        aria-label="rclaunch"
        onClick={() => onNavigate("instances")}
        className="mb-4 flex h-8 w-8 items-center justify-center rounded-md transition-opacity duration-100 hover:opacity-80"
      >
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          className="h-7 w-7 object-contain"
        />
      </button>

      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            active={screen === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </div>

      <div className="mt-auto">
        <RailButton
          item={{ id: "settings", label: "Настройки", icon: Settings }}
          active={screen === "settings"}
          onClick={() => onNavigate("settings")}
        />
      </div>
    </nav>
  );
}

function RailButton({
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
      onClick={onClick}
      className={clsx(
        "relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-100",
        active
          ? "bg-white/[0.07] text-white"
          : "text-muted hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {active && (
        <span className="absolute -left-[7px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent-500" />
      )}
      <Icon size={18} strokeWidth={1.7} />
    </button>
  );
}
