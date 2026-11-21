import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  Layers,
  Loader2,
  Package,
  Palette,
  Plus,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { Instance, ProjectType } from "../bindings";
import { PageHeader } from "../components/PageHeader";
import { IconButton } from "../components/IconButton";
import type { Screen } from "../components/Sidebar";
import { useInstallProject, useProjectSearch } from "../hooks/useModrinth";
import { formatDownloads, loaderLabel } from "../lib/format";

const tabs: { id: ProjectType; label: string; icon: LucideIcon }[] = [
  { id: "mod", label: "Моды", icon: Package },
  { id: "resourcepack", label: "Ресурспаки", icon: Palette },
  { id: "shader", label: "Шейдерпаки", icon: Sparkles },
];

const emptyCopy: Record<
  ProjectType,
  { title: string; text: string; action: string }
> = {
  mod: {
    title: "Моды требуют модлоадер",
    text: "Выбери инстанс с Fabric, Quilt, Forge или NeoForge.",
    action: "К инстансам",
  },
  resourcepack: {
    title: "Нет инстанса",
    text: "Ресурспаки ставятся в выбранный инстанс.",
    action: "Создать инстанс",
  },
  shader: {
    title: "Нет инстанса",
    text: "Шейдерпаки ставятся в выбранный инстанс.",
    action: "Создать инстанс",
  },
};

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
  const [projectType, setProjectType] = useState<ProjectType>("mod");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const needsLoader = projectType === "mod";
  const isVanilla = instance?.loader === "vanilla";
  const blocked = !instance || (needsLoader && isVanilla);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setInstalled(new Set());
    setFailed(new Set());
  }, [instance?.id, projectType]);

  useEffect(() => {
    setQuery("");
    setDebounced("");
  }, [projectType]);

  const { data, isLoading, isError } = useProjectSearch(
    debounced,
    instance?.minecraftVersion ?? null,
    needsLoader ? (instance?.loader ?? null) : null,
    projectType,
    !blocked,
  );
  const install = useInstallProject();

  const projects = data ?? [];
  const activeTab = tabs.find((tab) => tab.id === projectType) ?? tabs[0];

  const handleInstall = (projectId: string) => {
    if (!instance) {
      return;
    }
    const key = `${projectType}:${projectId}`;
    setFailed((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    install.mutate(
      { instanceId: instance.id, projectId, projectType },
      {
        onSuccess: () => setInstalled((current) => new Set(current).add(key)),
        onError: () => setFailed((current) => new Set(current).add(key)),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Моды"
        subtitle={
          instance
            ? `${instance.name} · ${instance.minecraftVersion} · ${
                loaderLabel[instance.loader]
              }`
            : "Выбери инстанс, чтобы ставить контент"
        }
        actions={
          <>
            {instance && (
              <div className="glass-field relative flex h-8 items-center rounded-lg pl-2">
                <Layers size={12} className="shrink-0 text-faint" />
                <select
                  value={instance.id}
                  onChange={(event) => onSelectInstance(event.target.value)}
                  className="h-full max-w-[11rem] appearance-none bg-transparent pl-1.5 pr-6 text-[12px] text-white outline-none"
                >
                  {instances.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                      className="bg-[#16171c]"
                    >
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2 text-faint"
                />
              </div>
            )}

            {!blocked && (
              <div className="glass-field flex h-8 w-56 items-center rounded-lg pl-2">
                <Search size={12} className="shrink-0 text-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Поиск: ${activeTab.label.toLowerCase()}`}
                  spellCheck={false}
                  className="h-full w-full bg-transparent pl-1.5 pr-2 text-[12px] text-white outline-none placeholder:text-faint"
                />
                {isLoading && (
                  <Loader2
                    size={12}
                    className="mr-2 shrink-0 animate-spin text-faint"
                  />
                )}
              </div>
            )}
          </>
        }
      >
        <div className="segmented mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                data-active={projectType === tab.id}
                onClick={() => setProjectType(tab.id)}
                className="segment"
              >
                <Icon size={13} strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </PageHeader>

      {blocked ? (
        <EmptyState
          type={projectType}
          isVanilla={Boolean(instance) && isVanilla}
          onAction={() => onNavigate("instances")}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
          {isError && (
            <div className="glass-card mx-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] text-red-400">
              <AlertTriangle size={14} />
              Modrinth недоступен. Проверь подключение.
            </div>
          )}

          {isLoading && projects.length === 0 && <ProjectSkeletons />}

          {!isLoading && !isError && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-20 text-center">
              <Search size={22} className="mb-2 text-faint" strokeWidth={1.5} />
              <p className="text-[12.5px] text-white">Ничего не найдено</p>
              <p className="text-[11px] text-faint">
                Попробуй другой запрос или смени версию игры.
              </p>
            </div>
          )}

          <div
            className={clsx(
              "grid gap-2",
              "[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]",
            )}
          >
            {projects.map((project) => {
              const key = `${projectType}:${project.id}`;
              const installing =
                install.isPending &&
                install.variables?.projectId === project.id &&
                install.variables?.projectType === projectType;
              const isInstalled = installed.has(key);
              const isFailed = failed.has(key);

              return (
                <article
                  key={project.id}
                  className="glass-card glass-card-hover flex min-h-[68px] min-w-0 items-center gap-3 rounded-xl p-2.5"
                >
                  {project.iconUrl ? (
                    <img
                      src={project.iconUrl}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-lg bg-white/[0.05] object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-faint">
                      <Package size={16} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-white">
                        {project.title}
                      </span>
                      <span className="shrink-0 truncate text-[10px] text-faint">
                        {project.author}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">
                      {project.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex items-center gap-1 text-[10px] text-faint">
                      <Download size={9} />
                      {formatDownloads(project.downloads)}
                    </span>

                    {isInstalled ? (
                      <span className="flex h-7 w-7 items-center justify-center">
                        <Check size={14} className="text-emerald-400" />
                      </span>
                    ) : isFailed ? (
                      <span
                        className="flex h-7 w-7 items-center justify-center"
                        title={
                          install.error instanceof Error
                            ? install.error.message
                            : "Не удалось установить"
                        }
                      >
                        <AlertTriangle size={14} className="text-red-400" />
                      </span>
                    ) : (
                      <IconButton
                        icon={installing ? Loader2 : Plus}
                        label={installing ? "Установка" : "Установить"}
                        size="sm"
                        disabled={install.isPending}
                        className={installing ? "animate-spin" : undefined}
                        onClick={() => handleInstall(project.id)}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {isLoading && projects.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-faint">
              <Loader2 size={12} className="animate-spin" />
              Modrinth
            </div>
          )}
        </div>
      )}
    </>
  );
}

function EmptyState({
  type,
  isVanilla,
  onAction,
}: {
  type: ProjectType;
  isVanilla: boolean;
  onAction: () => void;
}) {
  const copy =
    type === "mod" && isVanilla
      ? emptyCopy.mod
      : emptyCopy[type] ?? emptyCopy.resourcepack;
  const Icon = type === "mod" ? Package : type === "resourcepack" ? Palette : Sparkles;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-10 text-center">
      <span className="glass-card flex h-14 w-14 items-center justify-center rounded-2xl text-muted">
        <Icon size={26} strokeWidth={1.4} />
      </span>
      <div>
        <p className="text-[13px] font-medium text-white">{copy.title}</p>
        <p className="mt-1 max-w-xs text-[11.5px] leading-relaxed text-faint">
          {copy.text}
        </p>
      </div>
      <button type="button" onClick={onAction} className="btn-primary mt-1">
        <Plus size={14} />
        {copy.action}
      </button>
    </div>
  );
}

function ProjectSkeletons() {
  return (
    <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="glass-card flex min-h-[68px] animate-pulse items-center gap-3 rounded-xl p-2.5"
        >
          <div className="h-10 w-10 rounded-lg bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-32 rounded bg-white/[0.07]" />
            <div className="h-2 w-full max-w-56 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
