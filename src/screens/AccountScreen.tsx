import {
  AlertTriangle,
  Check,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  UserRound,
} from "lucide-react";

import type { Account } from "../bindings";
import {
  useAccounts,
  useLogin,
  useLogoutAccount,
  useSetActiveAccount,
} from "../hooks/useAccounts";
import { IconButton } from "../components/IconButton";

export function AccountScreen() {
  const { data, isLoading } = useAccounts();
  const login = useLogin();
  const setActive = useSetActiveAccount();
  const logout = useLogoutAccount();

  const accounts = data?.accounts ?? [];
  const activeId = data?.activeId;
  const loginError = login.isError
    ? login.error instanceof Error
      ? login.error.message
      : String(login.error)
    : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Аккаунт</h1>
        <span className="text-[11px] text-faint">{accounts.length}</span>
        {accounts.length > 0 && (
          <div className="ml-auto">
            <IconButton
              icon={Plus}
              label="Добавить аккаунт"
              onClick={() => login.mutate()}
              disabled={login.isPending}
            />
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={18} className="animate-spin text-faint" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <UserRound size={30} className="text-faint" strokeWidth={1.4} />
          <p className="text-[12px] text-faint">Вход только через Microsoft</p>
          <button
            type="button"
            onClick={() => login.mutate()}
            disabled={login.isPending}
            className="flex h-8 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12px] font-medium text-white transition-colors duration-100 hover:bg-accent-500 disabled:opacity-40"
          >
            <LogIn size={14} />
            Войти
          </button>
          {loginError && (
            <p className="max-w-sm px-4 text-center text-[11px] text-red-400">
              {loginError}
            </p>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-2 rounded-md px-2 py-2 transition-colors duration-100 hover:bg-white/[0.03]"
            >
              <button
                type="button"
                onClick={() => setActive.mutate(account.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <AccountHead account={account} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-white">
                    {account.name}
                  </span>
                  <span className="block truncate text-[10px] text-faint">
                    {account.id}
                  </span>
                </span>
                {account.id === activeId && (
                  <Check size={14} className="shrink-0 text-accent-400" />
                )}
              </button>
              <IconButton
                icon={LogOut}
                label="Выйти из аккаунта"
                size="sm"
                variant="danger"
                onClick={() => logout.mutate(account.id)}
              />
            </div>
          ))}

          {loginError && (
            <div className="flex items-start gap-2 px-2 py-3 text-[11px] text-red-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span className="break-words">{loginError}</span>
            </div>
          )}
        </div>
      )}

      {login.isPending && (
        <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="animate-pop flex w-[340px] flex-col items-center rounded-xl border border-line bg-panel-raised px-5 py-6 text-center">
            <Loader2 size={22} className="animate-spin text-accent-400" />
            <p className="mt-3 text-[13px] text-white">Окно Microsoft открыто</p>
            <p className="mt-1 text-[11px] leading-relaxed text-faint">
              Заверши вход в открывшемся окне. Чтобы отменить, просто закрой его.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountHead({ account }: { account: Account }) {
  const skin =
    account.skins.find((item) => item.state === "ACTIVE") ?? account.skins[0];

  if (!skin?.url) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-faint">
        <UserRound size={14} />
      </span>
    );
  }

  return (
    <span
      className="h-7 w-7 shrink-0 rounded-md bg-white/[0.05]"
      style={{
        backgroundImage: `url(${skin.url})`,
        backgroundSize: "224px 224px",
        backgroundPosition: "-28px -28px",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    />
  );
}
