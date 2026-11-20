import { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";

import type { LaunchState } from "../hooks/useLaunch";
import { IconButton } from "./IconButton";

interface LaunchConsoleProps {
  state: LaunchState;
  isRunning: boolean;
  onClose: () => void;
}

export function LaunchConsole({
  state,
  isRunning,
  onClose,
}: LaunchConsoleProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = logRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [state.logs]);

  const percent =
    state.progress && state.progress.total > 0
      ? Math.round((state.progress.completed / state.progress.total) * 100)
      : 0;

  const statusText = {
    idle: "",
    preparing: "подготовка",
    running: "запущено",
    exited: "завершено",
    error: "ошибка",
  }[state.status];

  return (
    <div className="animate-pop fixed bottom-3 right-3 z-50 flex w-[420px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-panel-raised">
      <header className="flex h-9 items-center gap-2 border-b border-line px-3">
        {isRunning && (
          <Loader2 size={12} className="animate-spin text-accent-400" />
        )}
        <span className="truncate text-[12px] text-white">
          {state.instanceName ?? "Запуск"}
        </span>
        <span className="text-[10px] text-faint">{statusText}</span>
        {!isRunning && (
          <div className="ml-auto">
            <IconButton icon={X} label="Закрыть" size="sm" onClick={onClose} />
          </div>
        )}
      </header>

      {(state.status === "preparing" || state.status === "running") && (
        <div className="px-3 py-2">
          <div className="flex items-center justify-between text-[10px] text-faint">
            <span>{state.stage || "подготовка"}</span>
            {state.progress && (
              <span>
                {state.progress.completed}/{state.progress.total}
              </span>
            )}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/[0.06]">
            <div
              className="h-full bg-accent-500 transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <div
        ref={logRef}
        className="max-h-44 min-h-16 overflow-y-auto border-t border-line px-3 py-2 font-mono text-[10px] leading-relaxed text-muted"
      >
        {state.logs.length === 0 ? (
          <span className="text-faint">Ожидание Java…</span>
        ) : (
          state.logs.map((line, index) => (
            <div key={index} className="whitespace-pre-wrap break-words">
              {line}
            </div>
          ))
        )}
      </div>

      {state.status === "error" && state.error && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-400">
          {state.error}
        </div>
      )}

      {state.status === "exited" && (
        <div className="border-t border-line px-3 py-2 text-[11px] text-muted">
          Игра завершена
          {state.exitCode !== null ? ` · код ${state.exitCode}` : ""}
        </div>
      )}
    </div>
  );
}
