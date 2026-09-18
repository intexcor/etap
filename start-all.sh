#!/bin/zsh
# Поднимает vllm-mlx (Qwen3-4B) + эмбеддинги (llama.cpp) + API + фронт в фоне. Логи в data/logs/. Остановить: ./stop-all.sh
cd "$(dirname "$0")"
mkdir -p data/logs
./stop-all.sh >/dev/null 2>&1
nohup npm run llm > data/logs/llm.log 2>&1 &
nohup npm run embed > data/logs/embed.log 2>&1 &
nohup npm run dev > data/logs/dev.log 2>&1 &
sleep 4
echo "LearnTok: http://localhost:5180   (логи: tail -f data/logs/dev.log)"
