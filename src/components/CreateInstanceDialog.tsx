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

  const canCreate =
    name.trim().length > 0 && version.length > 0 && !create.isPending;

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
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="glass-modal animate-pop flex max-h-[84vh] w-[440px] flex-col overflow-hidden rounded-2xl">
        <header className="flex shrink-0 items-center justify-between px-5 pb-1 pt-4">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight text-white">
              Новый инстанс
            </h2>
            <p className="mt-0.5 text-[10.5px] text-faint">
              Изолированная папка, версия и модлоадер
            </p>
          </div>
          <IconButton icon={X} label="Закрыть" size="sm" onClick={onClose} />
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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
              <span className="section-label">Версия</span>
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

            <div className="glass-field mt-1.5 flex h-9 items-center rounded-[10px] pl-2">
              <Search size={12} className="shrink-0 text-faint" />
              <input
                value={versionQuery}
                onChange={(event) => setVersionQuery(event.target.value)}
                placeholder="Поиск версии"
                spellCheck={false}
                className="h-full w-full bg-transparent pl-1.5 pr-2 text-[12px] text-white outline-none placeholder:text-faint"
              />
            </div>

            <div className="mt-1.5 max-h-36 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/25 p-1">
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
                      "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors duration-100",
                      version === entry.id
                        ? "bg-white/[0.1] text-white"
                        : "text-muted hover:bg-white/[0.05] hover:text-white",
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
            <span className="section-label">Модлоадер</span>
            <div className="mt-1.5 grid grid-cols-5 gap-1">
              {loaders.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLoader(item)}
                  className={clsx(
                    "h-8 truncate rounded-lg text-[10.5px] transition-colors duration-100",
                    loader === item
                      ? "bg-white/[0.13] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      : "text-muted hover:bg-white/[0.05] hover:text-white",
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
            <p className="break-words text-[11px] text-red-400">
              {errorMessage}
            </p>
          )}
        </div>

        <footer className="shrink-0 px-5 pb-4 pt-1">
          <div className="hairline mb-3" />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Отмена
            </button>
            <button
              type="button"
              disabled={!canCreate}
              onClick={submit}
              className="btn-primary"
            >
              {create.isPending && (
                <Loader2 size={13} className="animate-spin" />
              )}
              Создать
            </button>
          </div>
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
      <span className="section-label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
