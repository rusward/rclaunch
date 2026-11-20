# rclaunch

Лёгкий кроссплатформенный лаунчер Minecraft: только официальные аккаунты
Microsoft, изолированные инстансы как в PrismLauncher, мульти-аккаунт, скины и
плащи, моды из Modrinth. Минималистичный чёрно-белый интерфейс с синим акцентом.

> Статус: рабочий фундамент. Уже есть инстансы (создание/удаление, изоляция),
> вход Microsoft и мульти-аккаунт, превью скина/плаща, поиск и установка модов
> из Modrinth, манифест версий Mojang. Запуск игры — следующий этап.

## Стек

- **Ядро:** Rust (`crates/core`), без зависимости от UI.
- **Оболочка:** Tauri 2.
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4.
- **Данные:** TanStack Query.
- **Источники:** piston-meta.mojang.com, api.modrinth.com.

Подробности и принятые решения — в [STACK.md](./STACK.md).

## Требования

- Rust stable (ставится через [rustup](https://rustup.rs)).
- Node.js 20+ и [pnpm](https://pnpm.io).
- Системные зависимости Tauri 2:
  - **Fedora:** `sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel openssl-devel dbus-devel` и `sudo dnf group install "c-development"`.
  - **Debian/Ubuntu:** `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev`.
  - **Windows:** Visual Studio Build Tools (C++) + WebView2 (обычно уже есть).
  - **macOS:** Xcode Command Line Tools.

## Запуск

```bash
pnpm install
pnpm tauri dev
```

Сборка релиза:

```bash
pnpm tauri build
```

Только UI в обычном браузере (без Rust и Tauri). В этом режиме инстансы хранятся
в `localStorage`, а установка модов недоступна:

```bash
pnpm dev
# http://localhost:1420
```

### Сборка в контейнере

Если не хочется ставить Rust и системные библиотеки в систему, есть готовый
`contrib/Containerfile` (Ubuntu 24.04 + Rust + Node 22 + pnpm + webkit2gtk-4.1):

```bash
podman build -t rclaunch-build -f contrib/Containerfile .

podman run --rm --security-opt label=disable \
  -v "$PWD:/app" \
  -v rclaunch-node-modules:/app/node_modules \
  -w /app -e CI=true \
  rclaunch-build bash -lc 'pnpm install --frozen-lockfile && pnpm tauri build --no-bundle'
```

Бинарник появится в `src-tauri/target/release/rclaunch`. Флаг
`--security-opt label=disable` нужен для SELinux (Fedora); на системах без
SELinux его можно убрать. Для пакетов замените `--no-bundle` на
`--bundles deb,rpm` (AppImage требует FUSE).


## Структура

```
rclaunch/
├─ src/                      # React UI
│  ├─ screens/               # Instances, Mods, Account, Skins, Settings
│  ├─ components/            # Rail, IconButton, CreateInstanceDialog
│  ├─ hooks/                 # instances, versions, Modrinth
│  ├─ lib/                   # IPC-обёртки, форматирование
│  ├─ bindings.ts            # типы контракта UI ↔ Rust
│  ├─ App.tsx
│  └─ styles.css             # чёрно-белая тема
├─ src-tauri/                # тонкий слой Tauri: команды и состояние
│  ├─ src/commands.rs        # версии, инстансы, Modrinth
│  ├─ src/lib.rs             # builder, плагины, состояние
│  ├─ capabilities/          # минимальные разрешения
│  └─ tauri.conf.json
├─ crates/core/              # ядро
│  └─ src/
│     ├─ mojang/             # манифест версий
│     ├─ instances.rs        # инстансы, instances.json
│     ├─ modrinth.rs         # поиск и установка модов
│     ├─ auth.rs             # Microsoft, Xbox, Minecraft, аккаунты
│     ├─ paths.rs            # каталоги по ОС
│     └─ error.rs
├─ contrib/Containerfile     # сборка в контейнере
├─ public/logo.png
├─ STACK.md
└─ Cargo.toml                # workspace
```

## Что уже есть

- [x] Каркас workspace: `crates/core` + `src-tauri` + React.
- [x] Минималистичный UI: рейка, инстансы, моды, аккаунт, скины, настройки.
- [x] Инстансы: создание с версией и лоадером, изоляция, удаление.
- [x] `instances.json` с атомарной записью и безопасными id.
- [x] Вход Microsoft (публичный client_id, live.com) и мульти-аккаунт.
- [x] Refresh-токены в OS keychain, `accounts.json` с активным аккаунтом.
- [x] Превью скина (2D-canvas) и плаща из профиля.
- [x] Загрузка манифеста Mojang и выбор версии.
- [x] Modrinth: поиск под версию/лоадер и установка в `mods/` с SHA-512.
- [x] Иконки и тема из логотипа, MIT-лицензия, CI.

## Дальше

1. Свой Azure client_id → device code flow (публичный останется fallback).
2. Загрузка скина и выбор плаща через Minecraft Services.
3. Скачивание version JSON, client jar, libraries и ассетов с hash-проверкой.
4. JRE: Mojang manifest + Adoptium fallback.
5. Fabric/Quilt-профили и запуск игры с консолью логов.
6. Зависимости модов, ресурспаки и шейдеры Modrinth.

## Лицензия

MIT — см. [LICENSE](./LICENSE).
