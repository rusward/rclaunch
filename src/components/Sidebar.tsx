import clsx from "clsx";
import { Layers, LogIn, Package, Play, Settings } from "lucide-react";

const nav = [
  { label: "Играть", icon: Play, active: true },
  { label: "Версии", icon: Layers, active: false },
  { label: "Моды", icon: Package, active: false },
  { label: "Настройки", icon: Settings, active: false },
];

export function Sidebar() {
  return (
    <aside className="relative z-10 flex w-52 shrink-0 flex-col border-r border-white/5 bg-ink-950/60 px-3 py-4 backdrop-blur">
      <div className="flex items-center gap-2.5 px-2">
        <img
          src="/logo.png"
          alt="rclaunch"
          draggable={false}
          className="h-9 w-9 select-none object-contain"
        />
        <div className="leading-none">
          <div className="text-[17px] font-semibold tracking-tight text-white">
            rclaunch
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-brand-400/80">
            launcher
          </div>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {nav.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            disabled={!active}
            title={active ? undefined : "Появится позже"}
            className={clsx(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active
                ? "bg-brand-600/15 text-white ring-1 ring-brand-500/30"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400",
            )}
          >
            <Icon size={17} className={active ? "text-brand-400" : undefined} />
            {label}
            {!active && (
              <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">
                скоро
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-white/5 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-slate-500">
            <LogIn size={14} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] text-slate-300">
              Не выполнен вход
            </div>
            <div className="text-[10px] text-slate-500">Microsoft / offline</div>
          </div>
        </div>
        <button
          type="button"
          disabled
          title="Авторизация — следующий шаг"
          className="mt-3 w-full cursor-not-allowed rounded-lg bg-white/5 py-2 text-xs font-medium text-slate-500"
        >
          Войти
        </button>
      </div>
    </aside>
  );
}
