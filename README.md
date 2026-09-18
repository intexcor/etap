# ETAP: PDF → минутный урок

Тестовый конвейер берёт PDF, извлекает текст, отбирает релевантные фрагменты и делает JSON-сценарий для универсального вертикального ролика Remotion. По умолчанию используется локальная компактная LLM `qwen2.5:1.5b` через Ollama. Без запущенной LLM создаётся extractive-выжимка — конвейер можно проверить без ключей и облака.

## Быстрый запуск

```console
ollama pull qwen2.5:1.5b
npm run lesson -- --input /полный/путь/к/материалу.pdf
npm run render:lesson
```

Либо запустите `npm run web` и откройте `http://localhost:4173`: тестовая страница примет PDF и вернёт готовые props JSON. Затем сохраните их в `public/generated/lesson.json` и выполните рендер.

Результат: `public/generated/lesson.json` и `out/lesson.mp4`. Модель можно сменить: `OLLAMA_MODEL=qwen2.5:3b npm run lesson -- --input material.pdf`.

Для текстовых PDF рекомендуется `pdftotext` (Poppler); сканированные сначала требуют OCR. Retrieval MVP — лексический; в production его следует заменить эмбеддингами, векторным хранилищем и ссылками на страницы.

# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
