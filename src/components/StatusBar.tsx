import clsx from "clsx";

import { useAppInfo } from "../hooks/useVersions";

interface StatusBarProps {
  isLoading: boolean;
  isError: boolean;
  count: number;
}

export function StatusBar({ isLoading, isError, count }: StatusBarProps) {
  const { data: appInfo } = useAppInfo();

  const state = isError ? "offline" : isLoading ? "loading" : "online";

  return (
    <footer className="relative z-10 flex items-center justify-between border-t border-white/5 px-6 py-2 text-[11px] text-slate-500">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            state === "online" && "bg-emerald-400",
            state === "loading" && "animate-pulse bg-amber-400",
            state === "offline" && "bg-red-400",
          )}
        />
        {state === "online" && "Mojang API доступен"}
        {state === "loading" && "Подключение к Mojang…"}
        {state === "offline" && "Нет связи с Mojang"}
      </div>

      <div className="flex items-center gap-4">
        <span>Версий: {count}</span>
        <span className="text-slate-600">|</span>
        <span>rclaunch {appInfo ? `v${appInfo.version}` : ""}</span>
      </div>
    </footer>
  );
}
