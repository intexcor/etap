# LearnTok

Лента коротких обучающих роликов из любого материала: конспект, PDF лекции, глава учебника, код.

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
npm run dev                          # API :8787 + лента http://localhost:5180
```

Демо-курс без Claude, чтобы проверить озвучку и плеер: `npm run seed:demo`.

### Мок без ключа: локальная Qwen3-0.6B

Если `ANTHROPIC_API_KEY` не задан, сценарии пишет локальная модель через llama-server (выбор можно форсировать `LEARNTOK_PROVIDER=local|claude`).
JSON-схема передаётся в llama.cpp как грамматика, с лимитами длины строк и массивов, чтобы 0.6B не зацикливалась.
PDF читается через `pdftotext`, материал обрезается до `LOCAL_MAX_CHARS` (8000). Качество — только для отладки ленты.

```bash
# один раз: GGUF из локального кэша HF (нужен convert_hf_to_gguf.py из исходников llama.cpp)
python3 llama.cpp/convert_hf_to_gguf.py ~/.cache/huggingface/hub/models--Qwen--Qwen3-0.6B/snapshots/<rev> \
  --outfile models/qwen3-0.6b-q8_0.gguf --outtype q8_0
npm run llm   # llama-server на 127.0.0.1:8081
npm run dev
```

## Как устроено

| Где | Что |
|---|---|
| `shared/schema.ts` | Схема сценария: сцены `hook`, `definition`, `bullets`, `formula` (KaTeX), `code`, `steps`, `compare`, `example`, `summary` + квизы |
| `server/generate.ts` | Два шага через Claude (structured outputs): разбивка материала на темы → сценарий на каждую тему. Материал кэшируется между запросами |
| `server/tts.ts`, `tts.py` | Озвучка каждой сцены, тайминги слов для караоке-субтитров |
| `server/render.ts` | MP4 1080×1920 через Remotion, очередь по одному |
| `remotion/` | Видео: сцены, анимации, субтитры, прогресс |
| `web/` | Лента со свайпами, квизы, кнопка MP4 |

Данные лежат в `data/courses/<id>/` (`course.json`, `audio/`, `mp4/`).

## MP4

Для рендера нужен Chromium. Если на маке установлен Google Chrome, берётся он (по одной вкладке, ~1.5 мин на минуту видео).
Иначе Remotion сам скачает `chrome-headless-shell` (~95 МБ) с storage.googleapis.com. Браузер можно указать вручную:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run dev
npm run render -- <courseId> <lessonId>   # рендер из консоли
```

## Переменные

`ANTHROPIC_API_KEY`, `LEARNTOK_MODEL` (по умолчанию `claude-opus-5`), `PORT` (8787), `LEARNTOK_DATA`, `PYTHON`, `REMOTION_BROWSER_EXECUTABLE`.

Remotion бесплатен для физлиц и компаний до 3 человек, дальше нужна лицензия.
