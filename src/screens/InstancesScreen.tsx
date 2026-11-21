import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Boxes,
  Clock,
  Cpu,
  FolderOpen,
  Hammer,
  Layers,
  Loader2,
  LogIn,
  Play,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import type { Instance, Loader } from "../bindings";
import type { Screen } from "../components/Sidebar";
import { CreateInstanceDialog } from "../components/CreateInstanceDialog";
import { IconButton } from "../components/IconButton";
import { LaunchConsole } from "../components/LaunchConsole";
import { PageHeader } from "../components/PageHeader";
import { useAccounts } from "../hooks/useAccounts";
import { useLaunch } from "../hooks/useLaunch";
import { formatRelative, loaderLabel } from "../lib/format";

const loaderIcon: Record<Loader, LucideIcon> = {
  vanilla: Boxes,
  fabric: Layers,
  quilt: Layers,
  forge: Hammer,
  neoforge: Hammer,
};

interface InstancesScreenProps {
  instances: Instance[];
  isLoading: boolean;
  isError: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (instance: Instance) => void;
  onDelete: (id: string) => void;
  onNavigate: (screen: Screen) => void;
}

export function InstancesScreen({
  instances,
  isLoading,
  isError,
  selectedId,
  onSelect,
  onCreated,
  onDelete,
  onNavigate,
}: InstancesScreenProps) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data: accounts } = useAccounts();
  const launch = useLaunch();

  const activeAccount =
    accounts?.accounts.find((account) => account.id === accounts.activeId) ??
    null;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return instances;
    }
    return instances.filter((instance) => {
      const haystack =
        `${instance.name} ${instance.minecraftVersion} ${instance.loader}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [instances, query]);

  const selected =
    instances.find((instance) => instance.id === selectedId) ??
    instances[0] ??
    null;

  return (
    <>
      <PageHeader
        title="Инстансы"
        subtitle={
          instances.length === 0
            ? "Изолированные сборки Minecraft"
            : `Изолированные сборки · ${instances.length}`
        }
        actions={
          <>
            <div className="glass-field flex h-8 w-44 items-center rounded-lg pl-2">
              <Search size={12} className="shrink-0 text-faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск"
                spellCheck={false}
                className="h-full w-full bg-transparent pl-1.5 pr-2 text-[12px] text-white outline-none placeholder:text-faint"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary h-8 px-3 text-[12px]"
            >
              <Plus size={14} />
              Создать
            </button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <aside className="glass-card flex w-[252px] shrink-0 flex-col overflow-hidden rounded-2xl">
          <div className="px-4 pb-2 pt-3">
            <span className="section-label">Сборки</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {isLoading && <InstanceSkeletons />}

            {!isLoading && isError && (
              <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-red-400">
                <AlertTriangle size={14} />
                Ошибка загрузки
              </div>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <div className="px-2.5 py-6 text-center">
                <p className="text-[12px] text-faint">
                  {query ? "Ничего не найдено" : "Пока нет инстансов"}
                </p>
                {!query && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-3 text-[11.5px] text-accent-400 hover:text-accent-500"
                  >
                    Создать первый
                  </button>
                )}
              </div>
            )}

            {!isLoading &&
              !isError &&
              filtered.map((instance) => (
                <InstanceRow
                  key={instance.id}
                  instance={instance}
                  selected={instance.id === selected?.id}
                  onSelect={() => onSelect(instance.id)}
                />
              ))}
          </div>
        </aside>

        <InstanceDetail
          instance={selected}
          canPlay={Boolean(activeAccount)}
          isLaunching={launch.isRunning}
          onPlay={() => {
            if (selected) {
              launch.start(selected.id, selected.name);
            }
          }}
          onCreate={() => setCreateOpen(true)}
          onDelete={onDelete}
          onNavigate={onNavigate}
        />
      </div>

      {createOpen && (
        <CreateInstanceDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(instance) => {
            setCreateOpen(false);
            onCreated(instance);
          }}
        />
      )}

      {launch.open && (
        <LaunchConsole
          state={launch}
          isRunning={launch.isRunning}
          onClose={launch.close}
        />
      )}
    </>
  );
}

function InstanceRow({
  instance,
  selected,
  onSelect,
}: {
  instance: Instance;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = loaderIcon[instance.loader];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-100",
        selected
          ? "bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          : "hover:bg-white/[0.045]",
      )}
    >
      <span
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          selected
            ? "bg-accent-500/15 text-accent-400"
            : "bg-white/[0.05] text-muted",
        )}
      >
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-white">
          {instance.name}
        </span>
        <span className="block truncate text-[10.5px] text-faint">
          {instance.minecraftVersion} · {loaderLabel[instance.loader]}
        </span>
      </span>
      {selected && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
      )}
    </button>
  );
}

function InstanceDetail({
  instance,
  canPlay,
  isLaunching,
  onPlay,
  onCreate,
  onDelete,
  onNavigate,
}: {
  instance: Instance | null;
  canPlay: boolean;
  isLaunching: boolean;
  onPlay: () => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timer = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  useEffect(() => {
    setConfirming(false);
  }, [instance?.id]);

  if (!instance) {
    return (
      <section className="glass-card flex min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-2xl">
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          className="h-16 w-16 opacity-25"
        />
        <p className="text-[13px] text-muted">Создай свой первый инстанс</p>
        <p className="max-w-xs text-center text-[11.5px] leading-relaxed text-faint">
          Версия, модлоадер и отдельная папка игры — всё изолировано.
        </p>
        <button type="button" onClick={onCreate} className="btn-primary mt-2">
          <Plus size={14} />
          Создать инстанс
        </button>
      </section>
    );
  }

  const Icon = loaderIcon[instance.loader];

  return (
    <section className="glass-card min-w-0 flex-1 overflow-y-auto rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-white/[0.12] to-white/[0.02] text-accent-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
          <Icon size={24} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-white">
            {instance.name}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
            <span>Minecraft {instance.minecraftVersion}</span>
            <span className="text-faint">·</span>
            <span>{loaderLabel[instance.loader]}</span>
            {instance.loaderVersion && (
              <>
                <span className="text-faint">·</span>
                <span>{instance.loaderVersion}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canPlay || isLaunching}
          title={
            !canPlay
              ? "Сначала войди через Microsoft"
              : isLaunching
                ? "Игра уже запускается"
                : "Запустить игру"
          }
          onClick={onPlay}
          className="btn-primary px-5"
        >
          {isLaunching ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={13} fill="currentColor" />
          )}
          {isLaunching ? "Запуск…" : "Играть"}
        </button>

        {!canPlay && (
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="btn-ghost"
          >
            <LogIn size={14} />
            Войти
          </button>
        )}

        <IconButton icon={FolderOpen} label="Открыть папку" disabled />
        <IconButton icon={Settings2} label="Настройки инстанса" disabled />

        <div className="ml-auto flex items-center gap-1">
          {confirming && (
            <span className="text-[11px] text-red-400">Удалить?</span>
          )}
          <IconButton
            icon={Trash2}
            label={confirming ? "Подтвердить удаление" : "Удалить инстанс"}
            variant="danger"
            className={confirming ? "bg-red-500/10 text-red-400" : undefined}
            onClick={() => {
              if (confirming) {
                setConfirming(false);
                onDelete(instance.id);
              } else {
                setConfirming(true);
              }
            }}
          />
        </div>
      </div>

      <div className="mt-7 grid max-w-xl grid-cols-3 gap-2">
        <Stat
          icon={Cpu}
          value={`${instance.memoryMb} MB`}
          label="Память"
        />
        <Stat
          icon={Tag}
          value={instance.minecraftVersion}
          label="Версия"
        />
        <Stat
          icon={Clock}
          value={formatRelative(instance.lastPlayedAt)}
          label="Запуск"
        />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.045] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <Icon size={13} className="text-faint" />
      <div className="mt-2 truncate text-[12.5px] text-white" title={value}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-faint">
        {label}
      </div>
    </div>
  );
}

function InstanceSkeletons() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="mb-0.5 flex animate-pulse items-center gap-2.5 rounded-xl px-2 py-2"
        >
          <div className="h-8 w-8 rounded-lg bg-white/[0.05]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-white/[0.06]" />
            <div className="h-2 w-16 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5 px-2 pt-2 text-[11px] text-faint">
        <Loader2 size={12} className="animate-spin" />
        Загрузка
      </div>
    </>
  );
}
