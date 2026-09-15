# LearnTok

Лента коротких обучающих роликов из любого материала: конспект, PDF лекции, глава учебника, код.
Многопользовательский: аккаунты, прогресс, интервальные повторения, публичные курсы и курсы по ссылке, MP4 для TikTok/Reels.

```
материал → Claude: план тем → Claude: сценарий ролика (JSON-сцены) + квизы
         → edge-tts: озвучка с таймингами слов
         → Remotion: одни и те же React-сцены играют в ленте и рендерятся в MP4
```

## Запуск

```bash
npm install
python3 -m pip install edge-tts      # бесплатная озвучка, ключ не нужен
export ANTHROPIC_API_KEY=sk-ant-...  # для генерации уроков
npm run dev                          # API :8787 + фронт http://localhost:5180
```

Демо-курс без LLM (проверка озвучки, ленты, рендера): `npm run seed:demo` → вход `demo@learntok.local` / `demo1234`.

Прод: `npm run build && npm start` — Express отдаёт `dist/` и API на одном порту. Или `docker compose up -d` (внутри chromium, ffmpeg, edge-tts).

### Мок без ключа: локальная модель

Если `ANTHROPIC_API_KEY` не задан, сценарии пишет локальная модель (`LEARNTOK_PROVIDER=local|claude` форсирует выбор). Два варианта:

| | `npm run llm` (по умолчанию) | `npm run llm:cpp` |
|---|---|---|
| Движок | **vllm-mlx** (MLX, Apple Silicon) | llama.cpp |
| Модель | Qwen3-4B-Instruct 4-bit, `models/qwen3-4b-mlx-4bit` | Qwen3-0.6B Q8, `models/qwen3-0.6b-q8_0.gguf` |
| JSON | `LOCAL_JSON_MODE=prompt`: схема в промпте + zod-валидация с повторами | `LOCAL_JSON_MODE=grammar`: `response_format` → GBNF-грамматика |
| Порт | 8082 | 8081 |

Замеры на M4 (24 ГБ), 3 урока параллельно: vllm-mlx + 4B без грамматики — 60 с, 3/3 валидных; llama.cpp + 4B с грамматикой — 95 с;
vllm-mlx + грамматика — в 5–10 раз медленнее (энфорсер на Python), не использовать. Для llama.cpp задай
`LOCAL_LLM_URL=http://127.0.0.1:8081 LOCAL_MODEL=Qwen3-0.6B LOCAL_JSON_MODE=grammar`.

```bash
python3 -m venv .venv && .venv/bin/pip install vllm-mlx
.venv/bin/python -m mlx_lm convert --hf-path Qwen/Qwen3-4B-Instruct-2507 -q --q-bits 4 --mlx-path models/qwen3-4b-mlx-4bit
npm run llm
```

PDF читается через `pdftotext`, материал обрезается до `LOCAL_MAX_CHARS` (8000). Качество — для отладки, не для учёбы.

## Архитектура

| Где | Что |
|---|---|
| `shared/schema.ts` | Схема сценария (structured outputs): сцены `hook`, `definition`, `bullets`, `formula` (KaTeX), `code`, `steps`, `compare`, `example`, `summary` + квизы |
| `shared/api.ts` | DTO API. Квизы уходят клиенту без правильного ответа — проверка на сервере |
| `server/db.ts` | SQLite (`node:sqlite`, WAL), миграции. Таблицы: users, sessions, courses, lessons, jobs, lesson_progress, quiz_answers, reviews |
| `server/auth.ts` | Пароли scrypt, сессии в cookie (httpOnly), защита от перебора |
| `server/queue.ts` | Персистентная очередь задач (generate_course, render_lesson); прерванные задачи перезапускаются после рестарта |
| `server/pipeline.ts` | Генерация курса, идемпотентна: `retry` доделывает только неготовые уроки |
| `server/generate.ts`, `local.ts` | Claude (кэш материала между запросами, `fallbacks: "default"`) / локальная модель |
| `server/tts.ts`, `tts.py` | Озвучка каждой сцены, тайминги слов для караоке-субтитров |
| `server/render.ts` | MP4 1080×1920 через Remotion; аудио берётся с этого же сервера по внутреннему токену |
| `server/review.ts` | Интервальные повторения (SM-2 на уровне урока), двигает только первая попытка |
| `server/routes/` | `/api/auth/*`, `/api/me*`, `/api/courses*`, `/api/lessons/*`, `/api/review`, `/media/*` |
| `remotion/` | Видео: сцены, анимации, субтитры, прогресс |
| `web/src/` | React + Vite + Tailwind 4 + React Router + TanStack Query, PWA. Страницы: курсы, обзор, создание, курс, лента, повтор, профиль |

Данные: `data/learntok.sqlite`, `data/media/<courseId>/{audio,mp4}`, `data/uploads/<courseId>.pdf|txt`.

## MP4

Для рендера нужен Chromium. На маке с установленным Google Chrome берётся он (по одной вкладке, ~1.5 мин на минуту видео),
иначе Remotion скачает `chrome-headless-shell` (~95 МБ). Вручную: `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome`.
Remotion бесплатен для физлиц и компаний до 3 человек, дальше нужна лицензия.

## Переменные

`ANTHROPIC_API_KEY`, `LEARNTOK_MODEL` (`claude-opus-5`), `LEARNTOK_PROVIDER`, `PORT` (8787), `PUBLIC_URL` (для secure-cookie за https),
`LEARNTOK_DATA`, `LEARNTOK_REGISTRATION=closed`, `PYTHON`, `REMOTION_BROWSER_EXECUTABLE`, `LOCAL_LLM_URL`, `LOCAL_MODEL`, `LOCAL_JSON_MODE`, `LOCAL_MAX_CHARS`, `LOG_LEVEL`.
