import { LogIn, UserRound } from "lucide-react";

export function AccountScreen() {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-11 shrink-0 items-center border-b border-line px-4">
        <h1 className="text-[13px] font-medium text-white">Аккаунт</h1>
        <span className="ml-2.5 text-[11px] text-faint">0</span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <UserRound size={30} className="text-faint" strokeWidth={1.4} />
        <p className="text-[12px] text-faint">Вход только через Microsoft</p>
        <button
          type="button"
          disabled
          title="Авторизация — следующий шаг"
          className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-md bg-accent-600 px-3 text-[12px] font-medium text-white opacity-40"
        >
          <LogIn size={14} />
          Войти
        </button>
      </div>
    </div>
  );
}
