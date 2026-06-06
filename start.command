#!/bin/bash
# ==========================================
# 🎬 SyncPlay - 一键启动脚本
# ==========================================
# 启动信令服务器 + Web 客户端 + 自动打开浏览器
# 关闭：按 Ctrl+C 或运行 ./stop.sh
# ==========================================

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 路径
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/src/server"
CLIENT_DIR="$PROJECT_DIR/src/client"
SERVER_PORT=9000
CLIENT_PORT=8080

# 清理函数
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 关闭中...${NC}"
  [ -n "$SERVER_PID" ] && kill $SERVER_PID 2>/dev/null || true
  [ -n "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null || true
  sleep 1
  # 兜底清理
  pkill -f "node.*src/server/server.js" 2>/dev/null || true
  pkill -f "http.server $CLIENT_PORT" 2>/dev/null || true
  echo -e "${GREEN}✅ 已关闭${NC}"
  exit 0
}

trap cleanup INT TERM

echo ""
echo -e "${BLUE}🎬 SyncPlay - 一键启动${NC}"
echo "================================="
echo ""

# ===== 1. 环境检查 =====
echo -e "${BLUE}🔍 检查环境...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js 未安装${NC}"
  echo "   请访问 https://nodejs.org/ 安装"
  exit 1
fi
echo "  ✅ Node.js $(node --version)"

if ! command -v python3 &> /dev/null; then
  echo -e "${RED}❌ Python3 未安装${NC}"
  echo "   macOS: brew install python3"
  exit 1
fi
echo "  ✅ Python3 $(python3 --version | awk '{print $2}')"

# ===== 2. 端口检查 =====
if lsof -iTCP:$SERVER_PORT -sTCP:LISTEN &> /dev/null; then
  echo -e "${YELLOW}⚠️  端口 $SERVER_PORT 已被占用，先清理...${NC}"
  pkill -f "node.*src/server/server.js" 2>/dev/null || true
  sleep 1
fi
if lsof -iTCP:$CLIENT_PORT -sTCP:LISTEN &> /dev/null; then
  echo -e "${YELLOW}⚠️  端口 $CLIENT_PORT 已被占用，先清理...${NC}"
  pkill -f "http.server $CLIENT_PORT" 2>/dev/null || true
  sleep 1
fi

# ===== 3. 装依赖（首次）=====
if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo ""
  echo -e "${BLUE}📦 首次启动，安装服务端依赖...${NC}"
  (cd "$SERVER_DIR" && npm install --silent)
  echo "  ✅ 依赖安装完成"
fi

# ===== 4. 启动信令服务器 =====
echo ""
echo -e "${BLUE}🚀 启动信令服务器 (端口 $SERVER_PORT)...${NC}"
(cd "$SERVER_DIR" && npm start > /tmp/syncplay-server.log 2>&1) &
SERVER_PID=$!
sleep 2
if ! kill -0 $SERVER_PID &> /dev/null; then
  echo -e "${RED}❌ 信令服务器启动失败，查看日志:${NC}"
  echo "   tail -f /tmp/syncplay-server.log"
  exit 1
fi
echo "  ✅ 信令服务器运行中 (PID: $SERVER_PID)"

# ===== 5. 启动客户端 =====
echo -e "${BLUE}🌐 启动 Web 客户端 (端口 $CLIENT_PORT)...${NC}"
(cd "$CLIENT_DIR" && python3 -m http.server $CLIENT_PORT > /tmp/syncplay-client.log 2>&1) &
CLIENT_PID=$!
sleep 2
if ! kill -0 $CLIENT_PID &> /dev/null; then
  echo -e "${RED}❌ 客户端启动失败${NC}"
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo "  ✅ 客户端运行中 (PID: $CLIENT_PID)"

# ===== 6. 打开浏览器 =====
echo -e "${BLUE}🔗 打开浏览器...${NC}"
URL="http://localhost:$CLIENT_PORT"
if command -v open &> /dev/null; then
  open "$URL"
elif command -v xdg-open &> /dev/null; then
  xdg-open "$URL"
else
  echo "  请手动打开: $URL"
fi

# ===== 7. 提示信息 =====
echo ""
echo -e "${GREEN}════════════════════════════${NC}"
echo -e "${GREEN}✅ SyncPlay 已就绪！${NC}"
echo -e "${GREEN}════════════════════════════${NC}"
echo ""
echo "  📺 客户端:    $URL"
echo "  📡 信令服务器: http://localhost:$SERVER_PORT"
echo ""
echo -e "${YELLOW}🎯 使用方法：${NC}"
echo "  1. 当前窗口：选择视频 → 创建房间 → 复制房间号"
echo "  2. 另一个窗口（隐身或不同设备）打开同一网址"
echo "  3. 输入房间号加入 → 加载同一个视频 → 自动同步"
echo ""
echo -e "${YELLOW}🛑 关闭方式：${NC}"
echo "  • 按 Ctrl+C"
echo "  • 或运行 ./stop.sh"
echo ""
echo -e "${BLUE}⏳ 服务运行中... 关闭本窗口或按 Ctrl+C 停止${NC}"
echo ""

# 8. 保持前台运行
wait
