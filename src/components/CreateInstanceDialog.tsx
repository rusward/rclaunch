import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Check, Loader2, Search, X } from "lucide-react";

import type { Instance, Loader } from "../bindings";
import { useCreateInstance } from "../hooks/useInstances";
import { useVersions } from "../hooks/useVersions";
import { loaderLabel } from "../lib/format";
import { IconButton } from "./IconButton";

const loaders: Loader[] = ["vanilla", "fabric", "quilt", "forge", "neoforge"];

interface CreateInstanceDialogProps {
  onClose: () => void;
  onCreated: (instance: Instance) => void;
}

export function CreateInstanceDialog({
  onClose,
  onCreated,
}: CreateInstanceDialogProps) {
  const { data, isLoading, isError } = useVersions();
  const create = useCreateInstance();

  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [loader, setLoader] = useState<Loader>("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [snapshots, setSnapshots] = useState(false);
  const [versionQuery, setVersionQuery] = useState("");

  useEffect(() => {
    if (!version && data) {
      setVersion(data.latest.release);
    }
  }, [data, version]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const versions = useMemo(() => {
    const normalized = versionQuery.trim().toLowerCase();
    return (data?.versions ?? [])
      .filter((entry) => {
        if (!snapshots && entry.type !== "release") {
          return false;
        }
        return (
          normalized.length === 0 ||
          entry.id.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 150);
  }, [data, snapshots, versionQuery]);

  const canCreate = name.trim().length > 0 && version.length > 0 && !create.isPending;

  const submit = () => {
    if (!canCreate) {
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        minecraftVersion: version,
        loader,
        loaderVersion: loaderVersion.trim() || null,
        memoryMb: 4096,
      },
      { onSuccess: (instance) => onCreated(instance) },
    );
  };

  const errorMessage = create.isError
    ? create.error instanceof Error
      ? create.error.message
      : String(create.error)
    : null;

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="animate-pop flex max-h-[82vh] w-[420px] flex-col overflow-hidden rounded-xl border border-line bg-panel-raised">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="text-[13px] font-medium text-white">Новый инстанс</h2>
          <IconButton icon={X} label="Закрыть" size="sm" onClick={onClose} />
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <Field label="Название">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submit();
                }
              }}
              placeholder="Например, Survival"
              maxLength={64}
              spellCheck={false}
              className="input"
            />
          </Field>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-faint">
                Версия
              </span>
              <button
                type="button"
                onClick={() => setSnapshots((value) => !value)}
                className={clsx(
                  "text-[10px] transition-colors duration-100",
                  snapshots
                    ? "text-accent-400"
                    : "text-faint hover:text-muted",
                )}
              >
                снапшоты
              </button>
            </div>

            <div className="relative mt-1.5">
              <Search
                size={13}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={versionQuery}
                onChange={(event) => setVersionQuery(event.target.value)}
                placeholder="Поиск версии"
                spellCheck={false}
                className="input pl-7"
              />
            </div>

            <div className="mt-1.5 max-h-36 overflow-y-auto rounded-md border border-line bg-black p-1">
              {isLoading && (
                <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-faint">
                  <Loader2 size={12} className="animate-spin" />
                  Загрузка
                </div>
              )}
              {isError && (
                <div className="px-2 py-2 text-[11px] text-red-400">
                  Не удалось загрузить версии
                </div>
              )}
              {!isLoading &&
                !isError &&
                versions.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setVersion(entry.id)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] transition-colors duration-100",
                      version === entry.id
                        ? "bg-white/[0.07] text-white"
                        : "text-muted hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <span className="truncate">{entry.id}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-2 text-[10px] text-faint">
                      {entry.type}
                      {version === entry.id && (
                        <Check size={12} className="text-accent-400" />
                      )}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wide text-faint">
              Модлоадер
            </span>
            <div className="mt-1.5 grid grid-cols-5 gap-1">
              {loaders.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLoader(item)}
                  className={clsx(
                    "h-7 truncate rounded-md text-[10px] transition-colors duration-100",
                    loader === item
                      ? "bg-white/[0.08] text-white"
                      : "text-muted hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  {loaderLabel[item]}
                </button>
              ))}
            </div>
          </div>

          {loader !== "vanilla" && (
            <Field label="Версия модлоадера">
              <input
                value={loaderVersion}
                onChange={(event) => setLoaderVersion(event.target.value)}
                placeholder="последняя"
                spellCheck={false}
                className="input"
              />
            </Field>
          )}

          {errorMessage && (
            <p className="break-words text-[11px] text-red-400">{errorMessage}</p>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md px-3 text-[12px] text-muted transition-colors duration-100 hover:bg-white/[0.05] hover:text-white"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={submit}
            className="flex h-8 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12px] font-medium text-white transition-colors duration-100 hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {create.isPending && <Loader2 size={13} className="animate-spin" />}
            Создать
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
