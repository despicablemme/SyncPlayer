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
# WEB_ROOT: HTTP 服务根目录,设到 src/ 顶层(而不是 client/),
# 这样 ../shared/ 路径才能被 python http.server 正常服务
# 主页从 http://localhost:8080/client/ 进入
WEB_ROOT="$PROJECT_DIR/src"
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

# ============ 自动安装辅助函数 ============
# 如果某个工具没装,尝试用包管理器装
# 全部失败才打印手动安装说明 + 退出

# ensure_node: 检查 Node.js,缺失则自动装
ensure_node() {
  if command -v node &> /dev/null; then
    echo "  ✅ Node.js $(node --version)"
    return 0
  fi

  echo -e "${YELLOW}  ⚠️  Node.js 未安装,尝试自动安装...${NC}"

  # 方案 1: Homebrew(Mac 推荐)
  if command -v brew &> /dev/null; then
    echo -e "${BLUE}  → 用 Homebrew 安装 Node.js...${NC}"
    if brew install node 2>&1 | tail -10; then
      if command -v node &> /dev/null; then
        echo -e "${GREEN}  ✅ Node.js $(node --version) 已通过 Homebrew 安装${NC}"
        return 0
      fi
    fi
    echo -e "${YELLOW}  ⚠️  Homebrew 安装未生效,换 NVM...${NC}"
  fi

  # 方案 2: NVM(无需 Homebrew,任何 unix 都能用)
  echo -e "${BLUE}  → 装 NVM + Node.js LTS...${NC}"
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh 2>/dev/null | bash > /dev/null 2>&1
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

  if command -v nvm &> /dev/null; then
    nvm install --lts > /dev/null 2>&1
    nvm use --lts > /dev/null 2>&1
    if command -v node &> /dev/null; then
      echo -e "${GREEN}  ✅ Node.js $(node --version) 已通过 NVM 安装${NC}"
      return 0
    fi
  fi

  # 全部失败
  echo -e "${RED}  ❌ 自动安装失败${NC}"
  echo "  请手动安装:"
  echo "    1) 访问 https://nodejs.org/ 下载安装包"
  echo "    2) 或装 Homebrew(https://brew.sh/)后 brew install node"
  return 1
}

# ensure_python: 检查 Python3,缺失则自动装
ensure_python() {
  if command -v python3 &> /dev/null; then
    echo "  ✅ Python3 $(python3 --version 2>&1 | awk '{print $2}')"
    return 0
  fi

  echo -e "${YELLOW}  ⚠️  Python3 未安装,尝试自动安装...${NC}"

  # 方案 1: Homebrew
  if command -v brew &> /dev/null; then
    echo -e "${BLUE}  → 用 Homebrew 安装 Python3...${NC}"
    if brew install python 2>&1 | tail -5; then
      if command -v python3 &> /dev/null; then
        echo -e "${GREEN}  ✅ Python3 已通过 Homebrew 安装${NC}"
        return 0
      fi
    fi
  fi

  # 全部失败(Mac 没 Homebrew 基本只能手动装)
  echo -e "${RED}  ❌ 自动安装失败${NC}"
  echo "  请手动安装:"
  echo "    1) 访问 https://www.python.org/downloads/macos/"
  echo "    2) 或装 Homebrew(https://brew.sh/)后 brew install python"
  return 1
}

# wait_for_port PORT [MAX_SECONDS]
# 轮询端口直到 LISTEN,超时返回 1
wait_for_port() {
  local port=$1
  local max=${2:-10}
  local i=0
  while [ $i -lt $max ]; do
    if lsof -iTCP:"$port" -sTCP:LISTEN &> /dev/null; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

echo ""
echo -e "${BLUE}🎬 SyncPlay - 一键启动${NC}"
echo "================================="
echo ""

# ===== 1. 环境检查 + 自动安装 =====
echo -e "${BLUE}🔍 检查环境...${NC}"

ensure_node || exit 1
ensure_python || exit 1

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
sleep 2  # 给进程 2s 启动时间(如果启动失败会更快退出)

# 健康检查 1: 进程是否还活着
if ! kill -0 $SERVER_PID &> /dev/null; then
  echo -e "${RED}❌ 信令服务器进程已退出,查看日志:${NC}"
  echo "   文件: /tmp/syncplay-server.log"
  echo ""
  echo "   日志尾部:"
  tail -15 /tmp/syncplay-server.log | sed 's/^/     /'
  exit 1
fi

# 健康检查 2: 端口是否在监听
if ! wait_for_port $SERVER_PORT 10; then
  echo -e "${RED}❌ 端口 $SERVER_PORT 未在 10s 内监听,查看日志:${NC}"
  echo "   文件: /tmp/syncplay-server.log"
  echo ""
  echo "   日志尾部:"
  tail -15 /tmp/syncplay-server.log | sed 's/^/     /'
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
echo "  ✅ 信令服务器运行中 (PID: $SERVER_PID, port $SERVER_PORT)"

# ===== 5. 启动客户端(HTTP 服务) =====
echo -e "${BLUE}🌐 启动 Web 客户端 (端口 $CLIENT_PORT)...${NC}"
# 注意:HTTP 服务根目录是 src/(不是 client/),为了 ../shared/ 路径能服务
(cd "$WEB_ROOT" && python3 -m http.server $CLIENT_PORT > /tmp/syncplay-client.log 2>&1) &
CLIENT_PID=$!
sleep 2

# 健康检查 1: 进程是否还活着
if ! kill -0 $CLIENT_PID &> /dev/null; then
  echo -e "${RED}❌ 客户端进程已退出,查看日志:${NC}"
  echo "   文件: /tmp/syncplay-client.log"
  echo ""
  echo "   日志尾部:"
  tail -15 /tmp/syncplay-client.log | sed 's/^/     /'
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

# 健康检查 2: 端口是否在监听
if ! wait_for_port $CLIENT_PORT 10; then
  echo -e "${RED}❌ 端口 $CLIENT_PORT 未在 10s 内监听,查看日志:${NC}"
  echo "   文件: /tmp/syncplay-client.log"
  echo ""
  echo "   日志尾部:"
  tail -15 /tmp/syncplay-client.log | sed 's/^/     /'
  kill $SERVER_PID 2>/dev/null
  kill $CLIENT_PID 2>/dev/null
  exit 1
fi
echo "  ✅ 客户端运行中 (PID: $CLIENT_PID, port $CLIENT_PORT)"

# ===== 6. 打开浏览器 =====
echo -e "${BLUE}🔗 打开浏览器...${NC}"
URL="http://localhost:$CLIENT_PORT/client/"
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
