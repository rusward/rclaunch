import clsx from "clsx";
import { AlertTriangle, Boxes, Loader2, SearchX } from "lucide-react";

import type { VersionEntry } from "../bindings";
import { formatDate, versionTypeBadge, versionTypeLabel } from "../lib/format";

export type VersionFilter = "all" | "release" | "snapshot";

const filters: Array<{ id: VersionFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "release", label: "Релизы" },
  { id: "snapshot", label: "Снапшоты" },
];

interface VersionListProps {
  versions: VersionEntry[];
  latestRelease?: string;
  selectedId?: string;
  filter: VersionFilter;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onFilterChange: (filter: VersionFilter) => void;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

export function VersionList({
  versions,
  latestRelease,
  selectedId,
  filter,
  isLoading,
  isError,
  errorMessage,
  onFilterChange,
  onSelect,
  onRetry,
}: VersionListProps) {
  return (
    <section className="flex w-72 shrink-0 flex-col border-r border-white/5">
      <div className="flex gap-1.5 px-4 pb-3 pt-4">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
              filter === item.id
                ? "bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {isLoading && <VersionSkeletons />}

        {isError && (
          <div className="mx-1 mt-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-red-300">
              <AlertTriangle size={15} />
              Не удалось загрузить версии
            </div>
            <p className="mt-1.5 break-words text-xs leading-relaxed text-slate-400">
              {errorMessage ?? "Неизвестная ошибка"}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              Повторить
            </button>
          </div>
        )}

        {!isLoading && !isError && versions.length === 0 && (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <SearchX size={28} className="text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">Ничего не найдено</p>
            <p className="mt-1 text-xs text-slate-600">
              Попробуй изменить фильтр или запрос
            </p>
          </div>
        )}

        {!isLoading &&
          !isError &&
          versions.map((version) => {
            const selected = version.id === selectedId;
            return (
              <button
                key={version.id}
                type="button"
                onClick={() => onSelect(version.id)}
                className={clsx(
                  "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                  selected
                    ? "border-brand-500/40 bg-brand-600/15"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                    selected
                      ? "bg-brand-500/20 text-brand-300"
                      : "bg-ink-800 text-slate-500 group-hover:text-slate-300",
                  )}
                >
                  <Boxes size={16} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-100">
                      {version.id}
                    </span>
                    {version.id === latestRelease && (
                      <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                        latest
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span
                      className={clsx(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        versionTypeBadge[version.type],
                      )}
                    >
                      {versionTypeLabel[version.type]}
                    </span>
                    <span>{formatDate(version.releaseTime)}</span>
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );
}

function VersionSkeletons() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-3 rounded-xl px-3 py-2.5"
        >
          <div className="h-9 w-9 rounded-lg bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="h-2.5 w-32 rounded bg-white/[0.03]" />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-center gap-2 pt-4 text-xs text-slate-500">
        <Loader2 size={13} className="animate-spin" />
        Загружаем манифест Mojang
      </div>
    </>
  );
}
