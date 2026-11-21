# rclaunch — стек и архитектура

Minecraft-лаунчер: кроссплатформенный (Windows / Linux / macOS), лёгкий, только с
официальными аккаунтами Microsoft. Пользовательские изолированные инстансы,
мульти-аккаунт, скины/плащи и моды из Modrinth.

Статус документа: черновик решений (v0.2). По мере разработки решения фиксируются
в разделе «Журнал решений».

---

## 1. Принятые решения

| Область | Решение | Почему |
|---|---|---|
| Платформы | Windows 10+, Linux, macOS | Кроссплатформенность заложена с первого дня |
| UI | Tauri 2 + React + TypeScript + Vite | Малый бандл (~10 МБ), нативное окно, веб-UI |
| Ядро | Rust (edition 2021/2024) | Скорость, безопасность памяти, хорошая экосистема HTTP/архивов |
| Мост UI↔ядро | Tauri IPC (commands + events) | Типизированные команды, события прогресса |
| Авторизация | Microsoft OAuth (live.com auth code сейчас; device code после своего Azure) | Легальные аккаунты; офлайн-режима нет |
| Модлоадеры | Vanilla + Fabric + Quilt + Forge + NeoForge | Как в PrismLauncher; установка поэтапно |
| Инстансы | Изолированный каталог на сборку (версия + лоадер) | Независимые моды, миры и настройки |
| Моды | Поиск и установка с Modrinth | Прямо в лаунчере, без браузера |
| Скины | Смена скина и плаща через Minecraft Services + превью | Профиль аккаунта в лаунчере |
| Объём MVP | Инстансы, Java, аккаунт, запуск, Modrinth | Минимальный рабочий лаунчер |
| Хранилище настроек | JSON-файлы в конфиг-каталоге ОС | Просто, прозрачно, легко мигрировать |
| Секреты (токены) | OS keychain (`keyring`) | Не держим refresh-токены в открытом JSON |

---

## 2. Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (WebView)                                          │
│  React + TypeScript + Vite + Tailwind + Zustand/TanStack     │
│  Экраны: логин, список версий, настройки, консоль, прогресс   │
└───────────────▲──────────────────────────┬───────────────────┘
                │ Tauri events             │ invoke(command)
                │ (progress, log, state)   │
┌───────────────┴──────────────────────────▼───────────────────┐
│  Tauri 2 (Rust) — слой команд и разрешений                   │
│  capabilities: минимум прав, CSP, single-instance            │
└───────────────▲──────────────────────────────────────────────┘
                │ вызовы сервисов
┌───────────────┴──────────────────────────────────────────────┐
│  Core (Rust-библиотека, независима от Tauri)                 │
│  ├─ mojang     — манифест версий, version JSON               │
│  ├─ downloader — параллельные загрузки, hash-проверка         │
│  ├─ assets     — индексы ассетов, libraries, natives          │
│  ├─ java       — подбор/скачивание JRE                        │
│  ├─ auth       — Microsoft OAuth2, мульти-аккаунт            │
│  ├─ loaders    — Fabric / Quilt / Forge / NeoForge            │
│  ├─ launch     — сборка classpath/аргументов, spawn процесса  │
│  ├─ instances  — изолированные сборки, instances.json         │
│  ├─ modrinth   — поиск, установка модов, hash-проверка         │
│  ├─ skins      — скины, плащи, превью профиля                  │
│  └─ storage    — конфиг, кэш, логи                            │
└───────────────▲──────────────────────────────────────────────┘
                │ HTTPS
┌───────────────┴──────────────────────────────────────────────┐
│  Внешние сервисы                                             │
│  Mojang piston-meta / resources, Microsoft, Xbox,            │
│  Minecraft Services, Fabric/Quilt/Forge Meta, Modrinth       │
└──────────────────────────────────────────────────────────────┘
```

Ключевой принцип: **ядро не знает про UI**. `core` — отдельный Rust-крейт, который
можно тестировать и переиспользовать (CLI, будущий серверный режим).

---

## 3. Стек по слоям

### 3.1 Frontend

- **React 19 + TypeScript** — компонентный UI, строгая типизация IPC-контрактов.
- **Vite** — быстрый dev-сервер и сборка.
- **Tailwind CSS 4** — стили без раздувания CSS.
- **TanStack Query** — асинхронные данные (версии, инстансы, Modrinth).
- **lucide-react** — иконки.
- **@tauri-apps/api** — `invoke`, `listen`, работа с окном.
- **Zustand** — только если локального состояния станет много; сейчас хватает
  `useState` и TanStack Query.
- **React Router не используем:** экраны переключаются состоянием, без URL и
  истории браузера.
- **i18n** — позже, после стабилизации экранов.

TypeScript-типы событий и команд генерируются/поддерживаются вручную в
`src/bindings/` (единый контракт с Rust; позже можно подключить `ts-rs` или `specta`).

### 3.2 Tauri

- **Tauri 2.x**, WebView: WebView2 (Windows), WebKitGTK (Linux), WKWebView (macOS).
- Плагины:
  - `tauri-plugin-single-instance` — один экземпляр лаунчера.
  - `tauri-plugin-log` — логи приложения (файл + stdout).
  - `tauri-plugin-store` — некритичные настройки (не секреты).
  - `tauri-plugin-opener` — открыть папку игры / ссылки.
  - `tauri-plugin-updater` — автообновление лаунчера (позже).
- Минимальные capabilities: только нужные команды, без shell-доступа к произвольным
  программам (Java запускается из Rust, а не через shell-плагин).
- CSP включён, загрузка UI только из локальных ресурсов.

### 3.3 Rust-ядро

Основные крейты:

| Крейт | Назначение |
|---|---|
| `tokio` | асинхронный рантайм, параллельные загрузки |
| `reqwest` (rustls) | HTTP-клиент, без зависимости от системного OpenSSL |
| `serde` / `serde_json` | модели манифестов и настроек |
| `thiserror` / `anyhow` | типизированные ошибки ядра |
| `log` | логирование (вывод через `tauri-plugin-log`) |
| `zip` | распаковка natives и архивов |
| `tar` + `flate2` | распаковка JRE-архивов |
| `sha1` / `sha2` | проверка целостности файлов |
| `keyring` | refresh-токены в OS keychain |
| `directories` | пути конфига/данных по ОС |
| `uuid` | offline UUID (v3), идентификаторы инстансов |
| `futures` | ограничение параллелизма (`buffer_unordered`) |
| `tempfile` | атомарная загрузка (temp → rename) |
| `reqwest-middleware` + `reqwest-retry` | ретраи с backoff |
| `oauth2` | OAuth2 device code flow (Microsoft) |
| `minecraft-msa-auth` | обмен MSA-токена на Minecraft (Xbox → XSTS → MC) |

Правила загрузчика:
- Скачивать во временный файл, проверять SHA-1/SHA-256 из манифеста, затем атомарно
  переименовывать.
- Ограничивать параллелизм (например, 8–16 соединений).
- Пропускать уже валидные файлы (hash совпал) — повторный запуск почти мгновенный.
- Защита от zip-slip при распаковке (никаких путей вне целевого каталога).

### 3.4 Что пишем сами, а что берём готовым

Решение (ADR-006): **установку и запуск пишем сами**, **авторизацию берём готовую**.

Пишем сами (`crates/core`):

- парсинг манифестов Mojang, `rules`, natives, classpath;
- загрузчик: очередь, hash-проверка, ретраи, отмена, прогресс;
- ассеты, JRE, профили Fabric/Quilt;
- сборка аргументов и `spawn` процесса Java.

Берём готовым:

- `minecraft-msa-auth` + `oauth2` — device code и цепочка MSA → XBL → XSTS → MC;
- стандартные крейты для HTTP, архивов, хэшей, keychain.

Почему не `mc-launcher-core` / `crust_core` / `minecraft-java-rs-core`:

- все они появились или обновились в 2026, имеют 0–15★ и не используются массово;
- навязывают свою event-модель, раскладку каталогов и формат хранения аккаунта;
- прогресс, отмена, зеркала и атомарная запись — часть UX лаунчера, её не отдаём.

`mc-launcher-core` допустимо использовать как **справочник реализации**, но не как
зависимость. Если позже понадобится Forge/NeoForge, расширяем модуль `loaders`
(основная сложность там — installer, его и стоит изолировать).

Границы ответственности позволяют заменить auth-крейт без изменения остального
кода: `auth` — отдельный модуль с узким интерфейсом.

---

## 4. Внешние API и протоколы

### 4.1 Версии и файлы игры (Mojang)

- Манифест версий: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
- JSON версии: `url` из манифеста (piston-meta).
- Ассеты: `assetIndex.url`, файлы по `https://resources.download.minecraft.net/<xx>/<hash>`.
- Библиотеки: `libraries[].downloads.artifact` (+ `classifiers` для natives).
- Клиент: `downloads.client`; логины/аргументы — в `arguments` (новый формат) или
  `minecraftArguments` (старый).

Правила (`rules`) для библиотек и аргументов учитывают `os.name`, `os.arch`,
`os.version` и `features` (например, `has_custom_resolution`).

### 4.2 Ассеты

- Скачиваем объекты из `objects` (hash → путь `xx/hash`).
- Для старых версий (pre-1.7) — «virtual»/«map_to_resources» режимы раскладки ассетов.
- Индекс кладём в `assets/indexes/<id>.json`, объекты в `assets/objects/`.

### 4.3 Java

Текущая стратегия: **совместимая системная Java → Temurin с Adoptium**.

- `RCLAUNCH_JAVA` — ручное переопределение пути.
- Встроенная Java: `<data>/runtimes/temurin-<major>/bin/java`.
- Системная Java: принимается, если мажор совпадает; для требуемых 17+ допускается
  более новая (например, Java 25 для Minecraft 1.21).
- Иначе скачивается JRE:
  `https://api.adoptium.net/v3/binary/latest/{feature}/ga/{os}/{arch}/jre/hotspot/normal/eclipse`.
- Архив распаковывается в `runtimes/temurin-<major>` (tar.gz / zip).
- Манифест JRE Mojang можно добавить позже как альтернативный источник.

### 4.4 Авторизация Microsoft

Сейчас используется публичный client_id (`00000000402b5328`) и authorization code
flow `login.live.com` — он работает без своего Azure-приложения:

1. Открываем встроенное окно Tauri на `https://login.live.com/oauth20_authorize.srf`
   (`client_id`, `response_type=code`, `scope=...MBI_SSL`, `state`).
2. Перехватываем redirect на `https://login.live.com/oauth20_desktop.srf`,
   проверяем `state`, забираем `code`.
3. Меняем `code` на MSA-токен (`oauth20_token.srf`); `refresh_token` → keychain.
4. Xbox Live → XSTS → Minecraft Services → профиль (`skins`, `capes`).
5. Повторный вход — по `refresh_token`; аккаунт и профиль — в `accounts.json`.

Целевой режим после регистрации своего Azure-приложения:

- device code flow через `login.microsoftonline.com/consumers/oauth2/v2.0/devicecode`
  (без встроенного окна, надёжнее и удобнее);
- `client_id` читается из `RCLAUNCH_CLIENT_ID` или конфига, чтобы не менять код;
- публичный client_id остаётся fallback'ом для dev-сборок.

Ограничение: публичный client_id принадлежит Xbox-приложению, а не нам; для
публичного релиза нужен свой Azure app и одобрение Mojang.

### 4.5 Мульти-аккаунт

- Список аккаунтов в `accounts.json`; секреты — по одному ключу keychain на uuid.
- Активный аккаунт переключается без перезапуска; запуск игры берёт его сессию.
- При старте — тихое обновление токенов; обновление одного аккаунта не блокирует другие.
- Удаление аккаунта чистит и запись в keychain.
- Офлайн-режима нет: только официальные Microsoft-аккаунты.

### 4.6 Модлоадеры

- Fabric meta: `https://meta.fabricmc.net/v2/versions/loader/{game}`
  и готовый профиль `.../v2/versions/loader/{game}/{loader}/profile/json`.
- Quilt meta: аналогичный API `https://meta.quiltmc.org/v3/...`.
- Forge / NeoForge: установка через официальный installer или install profile;
  результат — version JSON с `inheritsFrom` (нужна Java).
- Профиль лоадера объединяем с базовой версией (libraries, arguments, mainClass).
- Общие read-only кэши (`libraries/`, `assets/`, `runtimes/`) не дублируем;
  изолируем `game/` инстанса: mods, config, saves, options.txt, logs.

### 4.7 Скины и плащи

- Профиль: `GET https://api.minecraftservices.com/minecraft/profile` —
  `skins[]`, `capes[]`, активные элементы.
- Смена скина: `POST .../minecraft/profile/skins` (multipart: `variant=classic|slim`,
  PNG 64×64 или URL).
- Плащ: `PUT .../minecraft/profile/capes/active` с `{ "capeId": "..." }`,
  снятие — `DELETE`.
- Превью — 2D-canvas из текстуры 64×64 (спереди/сзади) + изображение плаща;
  без 3D-библиотек, чтобы не утяжелять UI.
- Валидация PNG, размера и MIME до отправки.

### 4.8 Modrinth

- Поиск: `GET https://api.modrinth.com/v2/search` с facets
  `project_type:mod|resourcepack|shader`, `versions:<mc>`, а для модов ещё
  `categories:<loader>`.
- Версии проекта: `GET /v2/project/{id}/version?game_versions=[...]&loaders=[...]`
  (`loaders` только для модов).
- Файл: primary из ответа, SHA-512-проверка, запись в
  `instances/<id>/game/{mods|resourcepacks|shaderpacks}/<filename>`.
- Обязательные зависимости — устанавливаем рекурсивно (с защитой от циклов).
- `User-Agent: rclaunch/<version> (...)`; лимит запросов Modrinth — 300/мин.
- Модпаки — позже; моды, ресурспаки и шейдеры уже поддержаны одним API.

---

## 5. Структура репозитория

```
rclaunch/
├─ STACK.md
├─ README.md
├─ src/                     # frontend (React)
│  ├─ screens/              # Instances, Mods, Profile, Settings
│  ├─ components/           # Sidebar, PageHeader, IconButton, dialogs, console
│  ├─ hooks/                # instances, versions, Modrinth, auth, launch
│  ├─ lib/                  # IPC-обёртки, форматирование
│  ├─ bindings.ts           # типы контракта UI ↔ Rust
│  └─ styles.css            # glassmorphism: токены, оболочка, карточки
├─ src-tauri/
│  ├─ Cargo.toml            # workspace
│  ├─ tauri.conf.json
│  ├─ capabilities/
│  └─ src/                  # тонкий слой Tauri: команды, состояние
├─ crates/
│  └─ core/
│     ├─ Cargo.toml
│     └─ src/
│        ├─ lib.rs
│        ├─ mojang/         # манифест, version JSON, rules
│        ├─ instances.rs    # инстансы, instances.json, изоляция
│        ├─ modrinth.rs     # моды, ресурспаки, шейдерпаки
│        ├─ auth.rs         # Microsoft, Xbox, Minecraft, аккаунты
│        ├─ download.rs     # очередь, ретраи, hash, прогресс
│        ├─ java.rs         # выбор и установка JRE
│        ├─ version.rs      # libraries, natives, rules, merge
│        ├─ prepare.rs      # подготовка инстанса
│        ├─ launch.rs       # аргументы, classpath, процесс
│        ├─ paths.rs        # каталоги по ОС
│        └─ error.rs
├─ contrib/Containerfile     # воспроизводимая сборка
└─ .github/workflows/       # CI: fmt, clippy, тесты, tauri build
```

### Каталоги данных пользователя

| Что | Windows | Linux | macOS |
|---|---|---|---|
| Конфиг | `%APPDATA%\rclaunch` | `~/.config/rclaunch` | `~/Library/Application Support/rclaunch` |
| Данные | `%APPDATA%\rclaunch` | `~/.local/share/rclaunch` | `~/Library/Application Support/rclaunch` |
| Кэш | `%LOCALAPPDATA%\rclaunch\cache` | `~/.cache/rclaunch` | `~/Library/Caches/rclaunch` |

Раскладка данных:

```
<data>/
├─ instances/
│  └─ <slug>-<id>/
│     ├─ game/            # изолировано: mods, config, saves, options.txt, logs
│     └─ version/         # version JSON + лоадер-профиль
├─ libraries/             # общий read-only кэш
├─ assets/                # общий read-only кэш
└─ runtimes/              # JRE
```

`instances.json` и `accounts.json` — в конфиг-каталоге; токены — в keychain.

---

## 6. Ключевые сценарии

### 6.1 Создание инстанса

1. Пользователь задаёт имя, версию и модлоадер (vanilla/fabric/quilt/forge/neoforge).
2. Ядро создаёт `instances/<slug>-<id>/` с изолированным `game/`.
3. Для лоадера резолвится версия и сохраняется профиль.
4. Инстанс появляется в списке; версия/лоадер можно менять только явно.

### 6.2 Установка и запуск инстанса

1. Скачать version JSON и client jar, проверить SHA-1.
2. Для Fabric/Quilt подтянуть meta-профиль, объединить с базовой версией,
   разрешить Maven-библиотеки (`name` + `url`) и дедуплицировать по
   `group:artifact[:classifier]` — версия лоадера побеждает.
3. Скачать libraries с учётом `rules` (ОС/арх), natives-классификаторы и Maven fallback.
4. Скачать asset index и объекты в `assets/objects` (SHA-1 каждого файла).
5. Подобрать системную Java или установить Temurin JRE с Adoptium.
6. Распаковать natives в `instances/<id>/natives`.
7. Собрать classpath и аргументы JVM/игры для **game-dir инстанса**.
8. Запустить `java` как дочерний процесс, стримить stdout/stderr в консоль.
9. Отследить exit code и обновить `lastPlayedAt`.

Команда запуска (упрощённо):

```
java -Xmx<ram>M -Xms<ram>M \
  -Djava.library.path=<natives> \
  -cp <classpath> \
  <mainClass> \
  --username <name> --uuid <uuid> --accessToken <token> \
  --version <id> --gameDir <instance>/game --assetsDir <assets> \
  --assetIndex <index> --userType msa --versionType <release>
```

События UI: `launch:stage`, `launch:progress`, `launch:log`, `launch:started`,
`launch:exited`, `launch:error`.

### 6.3 Авторизация и мульти-аккаунт

1. UI вызывает `auth::start_device_code`.
2. Ядро возвращает `user_code` + `verification_uri`; UI показывает их.
3. Ядро опрашивает токен-эндпоинт; по готовности проходит цепочку Xbox → MC.
4. `refresh_token` → keychain (`account:<uuid>`), профиль → `accounts.json`.
5. При старте — тихое обновление всех аккаунтов; активный выбирается в UI.
6. Переключение аккаунта меняет сессию для следующего запуска без рестарта.

### 6.4 Скины и плащи

1. Профиль отдаёт список скинов/плащей и активные элементы.
2. UI рисует превью из текстуры 64×64 в canvas.
3. Загрузка PNG → проверка 64×64 и MIME → `POST /minecraft/profile/skins`.
4. Выбор плаща → `PUT /minecraft/profile/capes/active`.
5. После успеха обновляем профиль и превью.

### 6.5 Установка контента из Modrinth

1. Берём версию и лоадер выбранного инстанса; для ресурспаков/шейдеров лоадер
   не применяется.
2. Вкладки «Моды / Ресурспаки / Шейдерпаки» → поиск → выбор проекта.
3. Скачиваем primary-файл, проверяем SHA-512.
4. Кладём в `instances/<id>/game/{mods|resourcepacks|shaderpacks}/`.
5. Обязательные зависимости — рекурсивно, с защитой от циклов.
6. Показываем статус: установлено / ошибка / уже есть.

---

## 7. Безопасность

- Только HTTPS; проверка хэшей всех скачанных файлов из манифестов.
- Атомарная запись (temp → verify → rename), защита от zip-slip и path traversal.
- Минимальные Tauri capabilities; никакого произвольного shell-доступа.
- CSP, отсутствие загрузки удалённого кода в WebView.
- Секреты — в OS keychain; в логах токены маскируются.
- Валидация ника (длина, допустимые символы) и путей инстансов.
- Лимит размера/времени на загрузки, аккуратная обработка редиректов.

---

## 8. Сборка и CI

- `pnpm` для frontend, `cargo` для Rust.
- Dev: `pnpm tauri dev`; Prod: `pnpm tauri build`.
- GitHub Actions: матрица `windows-latest`, `ubuntu-22.04`, `macos-latest`
  (`tauri-apps/tauri-action`), артефакты: `.msi`/`.exe`, `.AppImage`/`.deb`,
  `.dmg`/`.app`.
- Проверки: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`,
  `tsc --noEmit`, `eslint`, `vitest`.
- Подпись кода/нотаризация — отдельная задача перед публичным релизом.

---

## 9. Объём MVP (v0.2)

Входит:
- Изолированные инстансы: создание, список, удаление, выбор версии и лоадера.
- Microsoft-вход (device code), мульти-аккаунт, хранение сессии в keychain.
- Vanilla + Fabric + Quilt: установка и запуск.
- Modrinth: моды, ресурспаки и шейдерпаки под версию/лоадер.
- Объединённый экран профиля: аккаунты, скин и плащ (превью 2D).
- Glassmorphism-UI с одним backdrop-blur на окно.
- Запуск игры с консолью логов и обработкой выхода.

Не входит в MVP (roadmap):
- Forge/NeoForge install (модель и UI уже поддерживают).
- Модпаки, обновление и удаление установленного контента.
- 3D-превью скина.
- Автообновление лаунчера.
- Серверный браузер/пинг серверов.
- Светлая тема.

---

## 10. Рассмотренные альтернативы

| Вариант | Плюсы | Минусы | Итог |
|---|---|---|---|
| Electron + React | Зрелость, примеры | ~150 МБ, высокое потребление RAM | Отклонено |
| C#/Avalonia | Удобно на Windows | Кроссплатформенность слабее, меньше Rust-экосистемы для задачи | Отклонено |
| Java/JavaFX | Родной язык экосистемы | Тяжёлый UI, JVM для самого лаунчера | Отклонено |
| Tauri + Rust | Лёгкий, быстрый, безопасный | Нужен Rust, WebView зависит от ОС | **Выбрано** |
| Node-ядро (без Rust) | Один язык с UI | Нужен рантайм, слабее по производительности/безопасности | Отклонено |

---

## 11. Журнал решений (ADR)

- **ADR-001** — Tauri 2 вместо Electron: размер и потребление ресурсов важнее
  обилия готовых примеров.
- **ADR-002** — ядро вынесено в отдельный крейт `core`, Tauri — тонкий адаптер.
- **ADR-003** — Microsoft OAuth: сейчас live.com authorization code во встроенном
  окне Tauri; device code — после своего Azure-приложения.
- **ADR-004** — в первую очередь Vanilla + Fabric + Quilt; Forge/NeoForge уже есть
  в модели инстансов и UI, установка — следующий этап.
- **ADR-005** — Java: совместимая системная или Temurin с Adoptium; манифест JRE
  Mojang можно добавить позже.
- **ADR-006** — установку, запуск и auth-цепочку пишем сами: готовые крейты не
  дают нужного контроля над прогрессом, кэшем и обработкой ошибок.
- **ADR-007** — проект открытый, лицензия MIT; тема оформления строится на палитре
  логотипа (чёрный фон + синие акценты), без внешних CDN и шрифтов.
- **ADR-008** — только легальные Microsoft-аккаунты; офлайн-режим не поддерживаем.
- **ADR-009** — каждый инстанс изолирован: свой `game/`, version JSON и лоадер;
  libraries/assets/runtimes — общий read-only кэш.
- **ADR-010** — моды ставим напрямую из Modrinth (поиск → версия → SHA-512 → mods/),
  без встроенного браузера.
- **ADR-011** — UI строго минималистичный: чёрный фон, белый текст, иконки,
  синий акцент из логотипа; без блюра, градиентных пятен и «веб-карточек».
  *(Заменено ADR-014.)*
- **ADR-012** — пока нет своего Azure-приложения, используем публичный client_id
  и live.com authorization code; после регистрации и одобрения Mojang переходим
  на device code без изменения остального кода.
- **ADR-013** — launch pipeline: version JSON + client jar, libraries (rules,
  natives, Maven fallback), assets с SHA-1, JRE, дедупликация библиотек по
  `group:artifact[:classifier]`, natives в каталог инстанса, spawn Java и стрим логов.
- **ADR-014** — glassmorphism-UI в духе macOS: плавающая полупрозрачная оболочка,
  мягкие градиентные пятна на фоне, крупные скругления и один `backdrop-filter`
  на всё окно. Внутренние карточки — без blur и без анимаций layout, чтобы не
  нагружать WebView. Аккаунт и скины объединены в «Профиль», а Modrinth получил
  три вкладки: моды, ресурспаки, шейдерпаки.

---

## 12. Открытые вопросы

1. Свой Azure `client_id` нужен для публичного релиза и device code; сейчас
   работает публичный client_id. Когда регистрируем — меняем конфиг, не код.
2. Когда добавлять установку Forge/NeoForge: сразу после запуска vanilla или позже?
3. Modrinth: моды, ресурспаки и шейдеры уже вместе; когда добавлять модпаки?
4. Превью скина: остаёмся на 2D-canvas или добавляем 3D?
5. Нужна ли поддержка старых версий (alpha/beta, pre-1.7 виртуальные ассеты)?
6. Локализация: только ru/en или сразу закладываем формат для сообщества?
7. Политика телеметрии/логов: что и куда отправляем (по умолчанию — ничего).

---

## 13. Брендинг и UI

Исходный логотип: `logo.png` в корне. Производные ассеты:

- `public/logo.png` — логотип для интерфейса (512 px, прозрачный фон);
- `src-tauri/icons/` — иконки приложения (RGBA PNG, `.ico`, `.icns`).

Палитра и поверхности:

| Токен | Значение | Назначение |
|---|---|---|
| `accent-400` | `#7CC0FF` | активные иконки, прогресс |
| `accent-500` | `#0A84FF` | основной синий, ссылки |
| `accent-600` | `#0071E3` | кнопки, нажатие |
| фон | `#05060A` | база под градиентными пятнами |
| `glass-shell` | белый 7.5% → 2.5% | главная стеклянная оболочка |
| `glass-card` | белый 4.5% | карточки, строки, панели |
| `panel-raised` | `rgba(24,25,31,.86)` | модальные окна |
| `line` | белый 9% | рамки и разделители |
| `muted` | белый 62% | вторичный текст |
| `faint` | белый 40% | подписи, метаданные |
| текст | `#F5F5F7` | основной текст |

Принципы:

- Одна «дорогая» поверхность: `backdrop-filter: blur(22px) saturate(135%)`
  только на оболочке окна (и отдельно на модалках/консоли). Карточки и строки —
  обычные полупрозрачные слои; так glassmorphism не убивает FPS.
- Фон — 3–4 статичных радиальных градиента (синий, серебристый, бирюзовый,
  тёплый), без анимации и без WebGL. Оболочка плавает с отступом 10 px,
  скругление 22 px, внутренний светлый hairline сверху.
- Радиусы: 22 px — оболочка, 16 px — карточки и панели, 12 px — строки,
  10 px — поля ввода, 12 px — кнопки. Мягкие тени только у оболочки и модалок.
- Типографика: системный SF/Segoe-стек, база 13 px, заголовки экранов 19 px,
  крупный заголовок инстанса 22 px. Плотные метки — 10 px uppercase + tracking.
- Навигация: сайдбар 216 px с иконкой и подписью; активный пункт — светлая
  «пилюля» с внутренним бликом. Внизу — карточка активного аккаунта.
- «Моды» — раздел с тремя сегментированными вкладками (Моды / Ресурспаки /
  Шейдерпаки) и сеткой карточек; ресурспаки и шейдеры доступны и на Vanilla.
- «Профиль» объединяет аккаунты, скин и плащ: слева превью, справа список
  аккаунтов и плащ.
- Анимации только 140–160 ms на цвет/прозрачность и появление модалок;
  никаких анимаций layout. Есть fallback без backdrop-filter и
  `prefers-reduced-motion`.
- Только локальные ассеты и системный font stack. Изображения Modrinth —
  `loading="lazy"`.
- Бюджет: JS < 350 КБ (gzip < 100 КБ), CSS < 40 КБ (gzip < 15 КБ).
- Сетка: сайдбар 216 px → контент; список инстансов 252 px; остальное — детали.

---

## 14. Лицензия и открытый код

- Проект распространяется под **MIT** (см. `LICENSE`).
- Зависимости держим в периметре MIT / Apache-2.0. LGPL-крейты (например,
  `minecraft-auth`) не подключаем, чтобы не усложнять дистрибуцию.
- Вклад: PR с `cargo fmt`, `cargo clippy -D warnings`, `cargo test` и
  `tsc --noEmit`; стиль коммитов — `type(scope): subject`.
- Публичные API-токены и `client_id` в репозиторий не коммитим.

