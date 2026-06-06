#!/bin/bash
# 🛑 SyncPlay - 关闭所有服务

echo "🛑 关闭 SyncPlay..."

# 通过端口查找并关闭（最可靠）
CLOSED=0

if PIDS=$(lsof -ti :9000 2>/dev/null); then
  echo "  · 关闭信令服务器 (端口 9000, PIDs: $PIDS)"
  kill $PIDS 2>/dev/null && CLOSED=$((CLOSED+1))
fi

if PIDS=$(lsof -ti :8080 2>/dev/null); then
  echo "  · 关闭客户端 (端口 8080, PIDs: $PIDS)"
  kill $PIDS 2>/dev/null && CLOSED=$((CLOSED+1))
fi

# 兜底：用 pkill 清掉相关进程
pkill -f "src/server/server.js" 2>/dev/null || true
pkill -f "http.server 8080" 2>/dev/null || true

sleep 1

# 验证
REMAINING=0
lsof -iTCP:9000 -sTCP:LISTEN &> /dev/null && REMAINING=$((REMAINING+1))
lsof -iTCP:8080 -sTCP:LISTEN &> /dev/null && REMAINING=$((REMAINING+1))

if [ $REMAINING -eq 0 ]; then
  echo "✅ 所有服务已关闭"
else
  echo "⚠️  仍有 $REMAINING 个端口被占用，试试 sudo"
fi
