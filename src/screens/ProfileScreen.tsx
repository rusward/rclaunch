import {
  AlertTriangle,
  Check,
  ImagePlus,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Shirt,
  UserRound,
} from "lucide-react";

import type { Account } from "../bindings";
import { PageHeader } from "../components/PageHeader";
import { IconButton } from "../components/IconButton";
import type { Screen } from "../components/Sidebar";
import { SkinPreview } from "../components/SkinPreview";
import {
  useAccounts,
  useLogin,
  useLogoutAccount,
  useSetActiveAccount,
} from "../hooks/useAccounts";

interface ProfileScreenProps {
  onNavigate: (screen: Screen) => void;
}

export function ProfileScreen({ onNavigate }: ProfileScreenProps) {
  const { data, isLoading } = useAccounts();
  const login = useLogin();
  const setActive = useSetActiveAccount();
  const logout = useLogoutAccount();

  const accounts = data?.accounts ?? [];
  const activeId = data?.activeId;
  const account =
    accounts.find((item) => item.id === activeId) ?? accounts[0] ?? null;

  const skin =
    account?.skins.find((item) => item.state === "ACTIVE") ??
    account?.skins[0] ??
    null;
  const cape =
    account?.capes.find((item) => item.state === "ACTIVE") ??
    account?.capes[0] ??
    null;

  const loginError = login.isError
    ? login.error instanceof Error
      ? login.error.message
      : String(login.error)
    : null;

  return (
    <>
      <PageHeader
        title="Профиль"
        subtitle={
          account
            ? `${account.name} · ${skin?.variant === "SLIM" ? "Slim" : "Classic"}`
            : "Аккаунт Microsoft, скин и плащ"
        }
      />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={18} className="animate-spin text-faint" />
        </div>
      ) : !account ? (
        <div className="flex flex-1 items-center justify-center px-6 pb-10">
          <div className="glass-card flex w-full max-w-sm flex-col items-center rounded-2xl px-6 py-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] text-muted">
              <UserRound size={28} strokeWidth={1.4} />
            </span>
            <p className="mt-4 text-[14px] font-medium text-white">
              Войди в аккаунт Microsoft
            </p>
            <p className="mt-1.5 max-w-[16rem] text-[11.5px] leading-relaxed text-faint">
              Официальный вход нужен для запуска игры, скинов и плащей.
            </p>
            <button
              type="button"
              onClick={() => login.mutate()}
              disabled={login.isPending}
              className="btn-primary mt-5"
            >
              {login.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LogIn size={14} />
              )}
              Войти
            </button>
            {loginError && (
              <p className="mt-3 max-w-full break-words text-[11px] text-red-400">
                {loginError}
              </p>
            )}
            <button
              type="button"
              onClick={() => onNavigate("instances")}
              className="btn-ghost mt-2"
            >
              Вернуться к инстансам
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto px-7 pb-6">
          <section className="glass-card flex w-[276px] shrink-0 flex-col items-center rounded-2xl p-5">
            <div className="flex h-[248px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent">
              <SkinPreview skin={skin} />
            </div>

            <h2 className="mt-4 max-w-full truncate text-[15px] font-semibold tracking-tight text-white">
              {account.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-faint">
              {skin?.variant === "SLIM" ? "Slim" : "Classic"}
              {skin?.alias ? ` · ${skin.alias}` : ""}
            </p>

            <div className="mt-4 flex w-full gap-2">
              <button
                type="button"
                disabled
                title="Загрузка скина — следующий шаг"
                className="btn-ghost flex-1 border border-white/[0.07] bg-white/[0.03]"
              >
                <ImagePlus size={13} />
                Скин
              </button>
              <button
                type="button"
                disabled
                title="Выбор плаща — следующий шаг"
                className="btn-ghost flex-1 border border-white/[0.07] bg-white/[0.03]"
              >
                <Shirt size={13} />
                Плащ
              </button>
            </div>
          </section>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <section className="glass-card overflow-hidden rounded-2xl">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="text-[12.5px] font-medium text-white">
                  Аккаунты
                </span>
                <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-faint">
                  {accounts.length}
                </span>
                <div className="ml-auto">
                  <IconButton
                    icon={Plus}
                    label="Добавить аккаунт"
                    size="sm"
                    onClick={() => login.mutate()}
                    disabled={login.isPending}
                  />
                </div>
              </div>

              <div className="hairline mx-4" />

              <div className="p-1.5">
                {accounts.map((item) => (
                  <AccountRow
                    key={item.id}
                    account={item}
                    active={item.id === account.id}
                    onSelect={() => setActive.mutate(item.id)}
                    onLogout={() => logout.mutate(item.id)}
                  />
                ))}
              </div>

              {loginError && (
                <div className="flex items-start gap-2 border-t border-line-soft px-4 py-2.5 text-[11px] text-red-400">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span className="break-words">{loginError}</span>
                </div>
              )}
            </section>

            <section className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="section-label">Плащ</span>
                  <p className="mt-1 text-[12.5px] text-white">
                    {cape?.alias ??
                      (cape?.url ? "Активный плащ" : "Плащ не выбран")}
                  </p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-muted">
                  <Shirt size={16} strokeWidth={1.6} />
                </span>
              </div>

              <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-b from-white/[0.05] to-transparent">
                {cape?.url ? (
                  <img
                    src={cape.url}
                    alt=""
                    className="h-16 w-32 object-contain [image-rendering:pixelated]"
                  />
                ) : (
                  <span className="text-[11px] text-faint">
                    Нет доступных плащей
                  </span>
                )}
              </div>
            </section>

            <section className="glass-card rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-faint">UUID</span>
                <span className="truncate pl-4 font-mono text-[10.5px] text-muted">
                  {account.id}
                </span>
              </div>
            </section>
          </div>
        </div>
      )}

      {login.isPending && (
        <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="glass-modal animate-pop flex w-[340px] flex-col items-center rounded-2xl px-5 py-6 text-center">
            <Loader2 size={22} className="animate-spin text-accent-400" />
            <p className="mt-3 text-[13px] font-medium text-white">
              Окно Microsoft открыто
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              Заверши вход в открывшемся окне. Чтобы отменить, просто закрой его.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function AccountRow({
  account,
  active,
  onSelect,
  onLogout,
}: {
  account: Account;
  active: boolean;
  onSelect: () => void;
  onLogout: () => void;
}) {
  const skin =
    account.skins.find((item) => item.state === "ACTIVE") ?? account.skins[0];

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2 py-2 transition-colors duration-100 ${
        active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        {skin?.url ? (
          <span
            className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.06]"
            style={{
              backgroundImage: `url(${skin.url})`,
              backgroundSize: "256px 256px",
              backgroundPosition: "-32px -32px",
              backgroundRepeat: "no-repeat",
              imageRendering: "pixelated",
            }}
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-faint">
            <UserRound size={15} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] text-white">
            {account.name}
          </span>
          <span className="block truncate text-[10px] text-faint">
            {account.id}
          </span>
        </span>
        {active && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[9.5px] font-medium text-accent-400">
            <Check size={9} />
            активный
          </span>
        )}
      </button>
      <IconButton
        icon={LogOut}
        label="Выйти из аккаунта"
        size="sm"
        variant="danger"
        onClick={onLogout}
      />
    </div>
  );
}
