# rclaunch — стек и архитектура

Minecraft-лаунчер: кроссплатформенный (Windows / Linux / macOS), лёгкий, с поддержкой
официальных аккаунтов Microsoft, офлайн-режима и модлоадеров Fabric/Quilt.

Статус документа: черновик решений (v0.1). По мере разработки решения фиксируются
в разделе «Журнал решений».

---

## 1. Принятые решения

| Область | Решение | Почему |
|---|---|---|
| Платформы | Windows 10+, Linux, macOS | Кроссплатформенность заложена с первого дня |
| UI | Tauri 2 + React + TypeScript + Vite | Малый бандл (~10 МБ), нативное окно, веб-UI |
| Ядро | Rust (edition 2021/2024) | Скорость, безопасность памяти, хорошая экосистема HTTP/архивов |
| Мост UI↔ядро | Tauri IPC (commands + events) | Типизированные команды, события прогресса |
| Авторизация | Microsoft OAuth2 (device code) + offline | Официальный вход и тестовые/локальные серверы |
| Модлоадеры (MVP) | Vanilla + Fabric + Quilt | Популярные, простой мета-API; Forge/NeoForge позже |
| Объём MVP | Версии, Java, аккаунт, запуск игры | Минимальный рабочий лаунчер |
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
│  ├─ auth       — Microsoft OAuth2 / offline UUID              │
│  ├─ loaders    — Fabric / Quilt профили                       │
│  ├─ launch     — сборка classpath/аргументов, spawn процесса  │
│  ├─ instances  — игровые каталоги, настройки                   │
│  └─ storage    — конфиг, кэш, логи                            │
└───────────────▲──────────────────────────────────────────────┘
                │ HTTPS
┌───────────────┴──────────────────────────────────────────────┐
│  Внешние сервисы                                             │
│  Mojang piston-meta / resources, Microsoft, Xbox, FabricMeta  │
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
- **Zustand** — локальное состояние UI (выбранная версия, экраны, модалки).
- **TanStack Query** — асинхронные данные (список версий, профиль, статусы).
- **React Router** — навигация между экранами.
- **i18next / react-i18next** — i18n (ru/en с самого начала).
- **lucide-react** — иконки.
- **@tauri-apps/api** — `invoke`, `listen`, работа с окном.

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

Стратегия: **сначала официальный манифест JRE от Mojang**, затем fallback на
Adoptium/Temurin.

- Mojang: `https://launchermeta.mojang.com/v1/products/java-runtime/...` — компоненты
  `jre-legacy`, `java-runtime-alpha/beta/gamma/delta` под конкретную платформу.
- Fallback: `https://api.adoptium.net/v3/binary/latest/{feature}/ga/{os}/{arch}/jre/hotspot/normal/eclipse`
  (например, Java 8/17/21 в зависимости от версии игры).
- JRE ставим в `<data>/runtimes/<component>/<os>-<arch>/`.
- Если найдена системная Java подходящей мажорной версии — можно использовать её
  (настройка «авто / системная / встроенная»).

### 4.4 Авторизация Microsoft

Поток device code (без встроенного браузера и без redirect-сервера):

1. `POST https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode`
   (client_id приложения Azure, scope `XboxLive.signin offline_access`).
2. Показываем пользователю код и ссылку `microsoft.com/link`.
3. Опрос `POST .../oauth2/v2.0/token` с `grant_type=urn:ietf:params:oauth:grant-type:device_code`
   до получения `access_token` + `refresh_token`.
4. Xbox Live: `POST https://user.auth.xboxlive.com/user/authenticate`.
5. XSTS: `POST https://xsts.auth.xboxlive.com/xsts/authorize`.
6. Minecraft: `POST https://api.minecraftservices.com/authentication/login_with_xbox`.
7. Профиль: `GET https://api.minecraftservices.com/minecraft/profile` (uuid, name, skins).
8. Обновление сессии — по `refresh_token`.

Хранение: `refresh_token` только в OS keychain; `access_token` — в памяти.
Отдельно обрабатываем типовые ошибки XSTS (нет Xbox-профиля, детский аккаунт и т.п.).

### 4.5 Offline-режим

- Ввод ника, без токенов.
- UUID: `UUIDv3(md5, "OfflinePlayer:" + username)` — совместимо с ванильным сервером.
- `accessToken` — фиктивное значение; `userType = legacy`/`offline`.

### 4.6 Fabric / Quilt

- Fabric meta: `https://meta.fabricmc.net/v2/versions/loader/{game}`
  и готовый профиль `.../v2/versions/loader/{game}/{loader}/profile/json`.
- Quilt meta: аналогичный API `https://meta.quiltmc.org/v3/...`.
- Профиль лоадера — это version JSON с `inheritsFrom`; объединяем с базовой версией
  (libraries, arguments, mainClass).
- Скачиваем лоадер-библиотеки в общий `libraries/`.

---

## 5. Структура репозитория

```
rclaunch/
├─ STACK.md
├─ README.md
├─ src/                     # frontend (React)
│  ├─ app/                  # роутинг, провайдеры
│  ├─ pages/                # Login, Versions, Settings, Console
│  ├─ components/           # UI-компоненты
│  ├─ bindings/             # типы IPC (команды/события)
│  ├─ stores/               # Zustand
│  └─ lib/                  # invoke-обёртки, i18n
├─ src-tauri/
│  ├─ Cargo.toml            # workspace
│  ├─ tauri.conf.json
│  ├─ capabilities/
│  └─ src/                  # тонкий слой Tauri: команды, события
├─ crates/
│  └─ core/
│     ├─ Cargo.toml
│     └─ src/
│        ├─ lib.rs
│        ├─ mojang/         # манифест, version JSON, rules
│        ├─ downloader/     # очередь, ретраи, hash, прогресс
│        ├─ assets/         # индексы, libraries, natives
│        ├─ java/           # выбор и установка JRE
│        ├─ auth/           # microsoft (device code), offline
│        ├─ loaders/        # fabric, quilt
│        ├─ launch/         # аргументы, classpath, процесс
│        ├─ instances/      # каталоги, настройки инстансов
│        └─ storage/        # paths, config, cache, logs
├─ docs/                    # ADR, заметки по API
└─ .github/workflows/       # CI: сборка под 3 ОС
```

### Каталоги данных пользователя

| Что | Windows | Linux | macOS |
|---|---|---|---|
| Конфиг | `%APPDATA%\rclaunch` | `~/.config/rclaunch` | `~/Library/Application Support/rclaunch` |
| Данные/игра | `%APPDATA%\rclaunch\game` | `~/.local/share/rclaunch` | `~/Library/Application Support/rclaunch` |
| Кэш | `%LOCALAPPDATA%\rclaunch\cache` | `~/.cache/rclaunch` | `~/Library/Caches/rclaunch` |

Внутри игрового каталога — стандартная раскладка `.minecraft`:
`versions/`, `libraries/`, `assets/`, `mods/`, `saves/`, `logs/`.

---

## 6. Ключевые сценарии

### 6.1 Установка и запуск версии

1. Загрузить манифест версий, выбрать версию.
2. Скачать version JSON, client jar, libraries (с учётом rules/OS).
3. Скачать asset index и объекты ассетов.
4. Подобрать/установить JRE нужной мажорной версии.
5. Для Fabric/Quilt — подтянуть профиль лоадера и его библиотеки.
6. Собрать classpath и аргументы JVM/игры.
7. Запустить `java` как дочерний процесс, стримить stdout/stderr в UI-консоль.
8. Отслеживать exit code; при необходимости показать диагностику (OOM, неверная Java).

Команда запуска (упрощённо):

```
java -Xmx<ram>M -Xms<ram>M \
  -Djava.library.path=<natives> \
  -cp <classpath> \
  <mainClass> \
  --username <name> --uuid <uuid> --accessToken <token> \
  --version <id> --gameDir <dir> --assetsDir <assets> \
  --assetIndex <index> --userType <msa|legacy> --versionType <release>
```

Прогресс передаётся событиями: `download:progress`, `install:stage`, `game:log`,
`game:exited`.

### 6.2 Авторизация

1. UI вызывает `auth::start_device_code`.
2. Ядро возвращает `user_code` + `verification_uri`; UI показывает их.
3. Ядро опрашивает токен-эндпоинт; по готовности проходит цепочку Xbox → MC.
4. `refresh_token` → keychain, профиль → UI.
5. При старте лаунчера — тихое обновление сессии, если токен ещё валиден.

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

## 9. Объём MVP (v0.1)

Входит:
- Список версий с сервера Mojang (release/snapshot фильтры).
- Установка vanilla-версии: client, libraries, assets, JRE.
- Microsoft-вход (device code) и offline-аккаунт, хранение сессии.
- Выбор версии, RAM (Xmx/Xms), папки игры.
- Запуск игры с консолью логов и обработкой выхода.
- Fabric/Quilt: установка лоадера для выбранной версии.
- Русский и английский интерфейс.

Не входит в MVP (roadmap):
- Forge/NeoForge.
- Менеджер модов и модпаков, установка из Modrinth/CurseForge.
- Скины и плащи, редактор скинов.
- Несколько инстансов с отдельными настройками.
- Автообновление лаунчера.
- Серверный браузер/пинг серверов.

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
- **ADR-003** — Microsoft device code flow вместо локального redirect-сервера:
  проще и безопаснее, работает на всех ОС.
- **ADR-004** — Fabric/Quilt в MVP, Forge/NeoForge отложены.
- **ADR-005** — JRE из манифеста Mojang с fallback на Adoptium.
- **ADR-006** — install/launch пишем сами, auth через `minecraft-msa-auth` + `oauth2`:
  готовых крейтов нужной зрелости нет, а установка/запуск — ядро UX лаунчера.
- **ADR-007** — проект открытый, лицензия MIT; тема оформления строится на палитре
  логотипа (чёрный фон + синие акценты), без внешних CDN и шрифтов.

---

## 12. Открытые вопросы

1. Какой `client_id` использовать для `minecraft-msa-auth`: публичный launcher-клиент
   (например, `00000000402b5328`) или собственное приложение Azure/Entra? — влияет на
   лимиты, брендинг и согласие пользователя.
2. Поддержка нескольких инстансов: сразу закладываем структуру каталогов или позже?
3. Автообновление лаунчера: `tauri-plugin-updater` + свой сервер обновлений?
4. Нужна ли поддержка старых версий (alpha/beta, pre-1.7 виртуальные ассеты) в v0.1?
5. Локализация: только ru/en или сразу закладываем формат для сообщества?
6. Политика телеметрии/логов: что и куда отправляем (по умолчанию — ничего).

---

## 13. Брендинг и UI

Исходный логотип: `logo.png` в корне. Производные ассеты:

- `public/logo.png` — логотип для интерфейса (512 px, прозрачный фон);
- `src-tauri/icons/` — иконки приложения (png, `.ico`, `.icns`) на тёмном
  скруглённом фоне.

Палитра снята с логотипа:

| Токен | HEX | Назначение |
|---|---|---|
| `brand-500` | `#209BFC` | яркий акцент, иконки, hover |
| `brand-600` | `#0957E9` | основной синий, кнопки, активные элементы |
| `brand-700` | `#0941CA` | глубокий синий, градиенты |
| `brand-800` | `#032CA5` | тени, фоновые пятна |
| `brand-900` | `#051A7C` | самый тёмный синий |
| `ink-950` | `#05070D` | фон приложения |
| `ink-900/850/800` | `#080C16` / `#0B1120` / `#0F172A` | поверхности и карточки |
| `ink-700/600` | `#16213A` / `#1E2C49` | границы, скроллбар |
| текст | `#DBE3F0` | основной текст |
| `#A4BEFB` | светло-голубой | мягкие подписи, свечение |

Принципы:

- Тёмная тема по умолчанию, без светлой в MVP.
- Никаких внешних CDN и веб-шрифтов: только локальные ассеты и системный
  font stack (Inter → system-ui).
- Синий — акцент, а не заливка: фон остаётся почти чёрным, сияние — через
  размытые радиальные градиенты.
- Сетка экрана «Играть»: сайдбар 240 px → список версий 368 px → карточка
  версии → статус-бар.

---

## 14. Лицензия и открытый код

- Проект распространяется под **MIT** (см. `LICENSE`).
- Зависимости держим в периметре MIT / Apache-2.0. LGPL-крейты (например,
  `minecraft-auth`) не подключаем, чтобы не усложнять дистрибуцию.
- Вклад: PR с `cargo fmt`, `cargo clippy -D warnings`, `cargo test` и
  `tsc --noEmit`; стиль коммитов — `type(scope): subject`.
- Публичные API-токены и `client_id` в репозиторий не коммитим.

