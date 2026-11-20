import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  Loader2,
  Package,
  Plus,
  Search,
} from "lucide-react";

import type { Instance } from "../bindings";
import { useInstallMod, useModrinthSearch } from "../hooks/useModrinth";
import { formatDownloads, loaderLabel } from "../lib/format";
import { IconButton } from "../components/IconButton";
import type { Screen } from "../components/Rail";

interface ModsScreenProps {
  instances: Instance[];
  instance: Instance | null;
  onSelectInstance: (id: string) => void;
  onNavigate: (screen: Screen) => void;
}

export function ModsScreen({
  instances,
  instance,
  onSelectInstance,
  onNavigate,
}: ModsScreenProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const isVanilla = instance?.loader === "vanilla";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setInstalled(new Set());
    setFailed(new Set());
  }, [instance?.id]);

  const { data, isLoading, isError } = useModrinthSearch(
    debounced,
    instance?.minecraftVersion ?? null,
    instance?.loader ?? null,
    Boolean(instance) && !isVanilla,
  );
  const install = useInstallMod();

  const mods = data ?? [];

  const handleInstall = (projectId: string) => {
    if (!instance) {
      return;
    }
    setFailed((current) => {
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
    install.mutate(
      { instanceId: instance.id, projectId },
      {
        onSuccess: () =>
          setInstalled((current) => new Set(current).add(projectId)),
        onError: () => setFailed((current) => new Set(current).add(projectId)),
      },
    );
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Моды</h1>

        <div className="ml-2 flex items-center gap-2">
          {instance ? (
            <>
              <select
                value={instance.id}
                onChange={(event) => onSelectInstance(event.target.value)}
                className="h-7 max-w-[13rem] rounded-md bg-white/[0.04] px-2 text-[12px] text-muted outline-none"
              >
                {instances.map((item) => (
                  <option key={item.id} value={item.id} className="bg-black">
                    {item.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-faint">
                {instance.minecraftVersion} · {loaderLabel[instance.loader]}
              </span>
            </>
          ) : (
            <span className="text-[11px] text-faint">Нет инстанса</span>
          )}
        </div>

        {instance && !isVanilla && (
          <div className="relative ml-auto">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск на Modrinth"
              spellCheck={false}
              className="h-7 w-56 rounded-md bg-white/[0.04] pl-7 pr-2 text-[12px] text-white outline-none transition-colors duration-100 placeholder:text-faint focus:bg-white/[0.06]"
            />
          </div>
        )}
      </header>

      {!instance ? (
        <EmptyState
          text="Сначала создай инстанс"
          action="Создать"
          onAction={() => onNavigate("instances")}
        />
      ) : isVanilla ? (
        <EmptyState
          text="Vanilla не поддерживает моды"
          action="Другой инстанс"
          onAction={() => onNavigate("instances")}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {isLoading && <ModSkeletons />}

          {!isLoading && isError && (
            <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-red-400">
              <AlertTriangle size={14} />
              Modrinth недоступен
            </div>
          )}

          {!isLoading && !isError && mods.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-faint">
              Ничего не найдено
            </div>
          )}

          {!isLoading &&
            !isError &&
            mods.map((mod) => {
              const installing =
                install.isPending && install.variables?.projectId === mod.id;
              const isInstalled = installed.has(mod.id);
              const isFailed = failed.has(mod.id);
              const errorMessage =
                isFailed && install.error instanceof Error
                  ? install.error.message
                  : undefined;

              return (
                <div
                  key={mod.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-100 hover:bg-white/[0.03]"
                >
                  {mod.iconUrl ? (
                    <img
                      src={mod.iconUrl}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 shrink-0 rounded-md bg-white/[0.04] object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-faint">
                      <Package size={14} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[12.5px] text-white">
                        {mod.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-faint">
                        {mod.author}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                      {mod.description}
                    </p>
                  </div>

                  <span className="shrink-0 text-[10px] text-faint">
                    {formatDownloads(mod.downloads)}
                  </span>

                  {isInstalled ? (
                    <span className="flex h-7 w-7 items-center justify-center">
                      <Check size={14} className="text-emerald-400" />
                    </span>
                  ) : isFailed ? (
                    <span
                      className="flex h-7 w-7 items-center justify-center"
                      title={errorMessage ?? "Не удалось установить"}
                    >
                      <AlertTriangle size={14} className="text-red-400" />
                    </span>
                  ) : (
                    <IconButton
                      icon={installing ? Loader2 : Download}
                      label={installing ? "Установка" : "Установить"}
                      size="sm"
                      disabled={install.isPending}
                      className={installing ? "animate-spin" : undefined}
                      onClick={() => handleInstall(mod.id)}
                    />
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  text,
  action,
  onAction,
}: {
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <Package size={28} className="text-faint" strokeWidth={1.4} />
      <p className="text-[12px] text-faint">{text}</p>
      <button
        type="button"
        onClick={onAction}
        className="flex h-8 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12px] font-medium text-white transition-colors duration-100 hover:bg-accent-500"
      >
        <Plus size={14} />
        {action}
      </button>
    </div>
  );
}

function ModSkeletons() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-3 rounded-md px-2 py-2"
        >
          <div className="h-8 w-8 rounded-md bg-white/[0.04]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-40 rounded bg-white/[0.05]" />
            <div className="h-2 w-64 rounded bg-white/[0.03]" />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5 px-2 pt-2 text-[11px] text-faint">
        <Loader2 size={12} className="animate-spin" />
        Modrinth
      </div>
    </>
  );
}
