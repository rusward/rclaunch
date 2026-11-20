# rclaunch

Лёгкий кроссплатформенный лаунчер Minecraft с официальной авторизацией,
поддержкой Fabric/Quilt и тёмной чёрно-синей темой.

> Статус: ранний скелет. Уже работает загрузка официального манифеста версий
> Mojang и список версий в UI. Установка и запуск игры — следующий этап.

## Стек

- **Ядро:** Rust (`crates/core`), без зависимости от UI.
- **Оболочка:** Tauri 2.
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4.
- **Состояние:** TanStack Query + Zustand.
- **Данные:** `version_manifest_v2.json` с piston-meta.mojang.com.

Подробности и принятые решения — в [STACK.md](./STACK.md).

## Требования

- Rust stable (ставится через [rustup](https://rustup.rs)).
- Node.js 20+ и [pnpm](https://pnpm.io).
- Системные зависимости Tauri 2:
  - **Fedora:** `sudo dnf install webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel openssl-devel` и `sudo dnf group install "c-development"`.
  - **Debian/Ubuntu:** `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.
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

Только UI в обычном браузере (без Rust и Tauri — манифест грузится напрямую):

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
│  ├─ components/            # Sidebar, VersionList, VersionDetails, StatusBar
│  ├─ hooks/                 # useVersions, useAppInfo
│  ├─ lib/                   # IPC-обёртки, форматирование
│  ├─ bindings.ts            # типы контракта UI ↔ Rust
│  ├─ App.tsx
│  └─ styles.css             # тема Tailwind (цвета бренда)
├─ src-tauri/                # тонкий слой Tauri: команды и события
│  ├─ src/commands.rs        # app_info, versions_manifest
│  ├─ src/lib.rs             # builder, плагины, состояние
│  ├─ capabilities/          # минимальные разрешения
│  └─ tauri.conf.json
├─ crates/core/              # ядро: Mojang API, пути, установка, запуск
│  └─ src/
│     ├─ mojang/             # манифест версий
│     ├─ paths.rs            # каталоги по ОС
│     └─ error.rs
├─ public/logo.png
├─ STACK.md
└─ Cargo.toml                # workspace
```

## Что уже есть

- [x] Каркас workspace: `crates/core` + `src-tauri` + React.
- [x] Загрузка `version_manifest_v2.json` и парсинг в типизированные структуры.
- [x] Tauri-команда `versions_manifest`, IPC-обёртка и типы на фронте.
- [x] UI: список версий, фильтры, поиск, карточка версии, статус-бар.
- [x] Тёмная чёрно-синяя тема и иконки из логотипа.
- [x] MIT-лицензия.

## Дальше

1. Скачивание version JSON, client jar, libraries и ассетов с hash-проверкой.
2. Подбор и установка JRE (Mojang manifest + Adoptium fallback).
3. Microsoft-авторизация (`minecraft-msa-auth` + `oauth2`) и offline-режим.
4. Fabric/Quilt-профили.
5. Сборка аргументов, запуск Java и консоль логов.
6. Несколько инстансов, настройки RAM, i18n.

## Лицензия

MIT — см. [LICENSE](./LICENSE).
