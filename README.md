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

### Мок без ключа: локальная Qwen3-0.6B

Если `ANTHROPIC_API_KEY` не задан, сценарии пишет локальная модель через llama-server (`LEARNTOK_PROVIDER=local|claude` форсирует выбор).
JSON-схема передаётся в llama.cpp как грамматика с лимитами длины, чтобы 0.6B не зацикливалась. PDF читается через `pdftotext`,
материал обрезается до `LOCAL_MAX_CHARS` (8000). Качество — только для отладки.

```bash
python3 llama.cpp/convert_hf_to_gguf.py ~/.cache/huggingface/hub/models--Qwen--Qwen3-0.6B/snapshots/<rev> \
  --outfile models/qwen3-0.6b-q8_0.gguf --outtype q8_0
npm run llm   # llama-server на 127.0.0.1:8081
```

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
`LEARNTOK_DATA`, `LEARNTOK_REGISTRATION=closed`, `PYTHON`, `REMOTION_BROWSER_EXECUTABLE`, `LOCAL_LLM_URL`, `LOCAL_MODEL`, `LOCAL_MAX_CHARS`, `LOG_LEVEL`.
