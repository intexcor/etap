# LearnTok: API + собранный фронтенд + рендер MP4 в одном контейнере.
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:26-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# ffmpeg — длительность аудио и MP4; poppler — pdftotext для локального мока; chromium — рендер Remotion;
# python3 + edge-tts — озвучка.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg poppler-utils python3 python3-pip chromium fonts-liberation fonts-noto-color-emoji ca-certificates \
    && pip3 install --no-cache-dir --break-system-packages edge-tts \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY server ./server
COPY shared ./shared
COPY remotion ./remotion
ENV PORT=8787 LEARNTOK_DATA=/data REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
VOLUME /data
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
