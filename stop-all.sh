#!/bin/zsh
pkill -f "llama-server" ; pkill -f "vllm-mlx serve" ; pkill -f "tsx watch server/index.ts" ; pkill -f "learntok/node_modules/.bin/vite" ; pkill -f "concurrently -k -n api,web"
echo "остановлено"
