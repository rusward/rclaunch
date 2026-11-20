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
  Package,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import type { Instance, Loader } from "../bindings";
import type { Screen } from "../components/Rail";
import { LaunchConsole } from "../components/LaunchConsole";
import { useAccounts } from "../hooks/useAccounts";
import { useLaunch } from "../hooks/useLaunch";
import { formatRelative, loaderLabel } from "../lib/format";
import { CreateInstanceDialog } from "../components/CreateInstanceDialog";
import { IconButton } from "../components/IconButton";

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
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Инстансы</h1>
        <span className="text-[11px] text-faint">{instances.length}</span>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
              spellCheck={false}
              className="h-7 w-40 rounded-md bg-white/[0.04] pl-7 pr-2 text-[12px] text-white outline-none transition-colors duration-100 placeholder:text-faint focus:bg-white/[0.06]"
            />
          </div>
          <IconButton
            icon={Plus}
            label="Создать инстанс"
            onClick={() => setCreateOpen(true)}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-[248px] shrink-0 overflow-y-auto border-r border-line p-1.5">
          {isLoading && <InstanceSkeletons />}

          {!isLoading && isError && (
            <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-red-400">
              <AlertTriangle size={14} />
              Ошибка загрузки
            </div>
          )}

          {!isLoading && !isError && filtered.length === 0 && (
            <div className="px-2 py-3 text-[12px] text-faint">
              {query ? "Ничего не найдено" : "Нет инстансов"}
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
    </div>
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
        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-100",
        selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      <span
        className={clsx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04]",
          selected ? "text-accent-400" : "text-muted",
        )}
      >
        <Icon size={14} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-white">
          {instance.name}
        </span>
        <span className="block truncate text-[11px] text-faint">
          {instance.minecraftVersion} · {loaderLabel[instance.loader]}
        </span>
      </span>
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
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3">
        <img
          src="/logo.png"
          alt=""
          draggable={false}
          className="h-14 w-14 opacity-20"
        />
        <p className="text-[12px] text-faint">Нет инстансов</p>
        <button
          type="button"
          onClick={onCreate}
          className="flex h-8 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12px] font-medium text-white transition-colors duration-100 hover:bg-accent-500"
        >
          <Plus size={14} />
          Создать
        </button>
      </section>
    );
  }

  const Icon = loaderIcon[instance.loader];

  return (
    <section className="flex min-w-0 flex-1 flex-col p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-accent-400">
          <Icon size={20} strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-semibold tracking-tight text-white">
            {instance.name}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            {instance.minecraftVersion} · {loaderLabel[instance.loader]}
            {instance.loaderVersion ? ` ${instance.loaderVersion}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
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
          className={clsx(
            "flex h-9 items-center gap-2 rounded-md px-4 text-[12px] font-medium text-white transition-colors duration-100",
            canPlay && !isLaunching
              ? "bg-accent-600 hover:bg-accent-500"
              : "cursor-not-allowed bg-accent-600 opacity-60",
          )}
        >
          {isLaunching ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
          {isLaunching ? "Запуск" : "Играть"}
        </button>
        {!canPlay && (
          <button
            type="button"
            onClick={() => onNavigate("account")}
            className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[12px] text-muted transition-colors duration-100 hover:bg-white/[0.05] hover:text-white"
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

      <div className="mt-8 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <Stat
          icon={Cpu}
          value={`${instance.memoryMb} MB`}
          label="RAM"
        />
        <Stat icon={Package} value="0" label="Моды" />
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
    <div className="bg-black px-4 py-3">
      <Icon size={13} className="text-faint" />
      <div className="mt-2 truncate text-[12px] text-white" title={value}>
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
          className="flex animate-pulse items-center gap-2.5 rounded-md px-2 py-2"
        >
          <div className="h-7 w-7 rounded-md bg-white/[0.04]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-white/[0.05]" />
            <div className="h-2 w-16 rounded bg-white/[0.03]" />
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
