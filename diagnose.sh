#!/bin/bash
# ==========================================
#   SyncPlay 环境诊断脚本 (Mac/Linux)
# ==========================================
#   作用:一键收集本机环境信息,贴给开发者
#   用法:./diagnose.sh
#        或重定向:./diagnose.sh > diagnose-output.txt
# ==========================================

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

ok()  { echo -e "  ${GREEN}[OK]${NC} $1"; }
err() { echo -e "  ${RED}[X]${NC} $1"; }
warn(){ echo -e "  ${YELLOW}[!]${NC}  $1"; }
info(){ echo -e "  ${GRAY}-${NC}  $1"; }

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================================"
echo -e "  ${BLUE}SyncPlay 环境诊断 v1.0${NC}"
echo "============================================================"
echo "  时间: $(date)"
echo "  电脑: $(hostname)"
echo "  用户: $(whoami)"
echo "============================================================"
echo ""

# ============= [1/8] 脚本与项目结构 =============
echo -e "${BLUE}[1/8]${NC} 脚本与项目结构"
echo "  脚本位置: $PROJECT_DIR"
[ -f "$PROJECT_DIR/start.sh" ] && ok "start.sh" || err "缺 start.sh"
[ -f "$PROJECT_DIR/start.command" ] && ok "start.command" || warn "缺 start.command (非必需)"
[ -f "$PROJECT_DIR/stop.sh" ] && ok "stop.sh" || warn "缺 stop.sh (非必需)"
[ -f "$PROJECT_DIR/package.json" ] && ok "package.json" || err "缺 package.json"
echo "  关键目录:"
for d in src src/server src/client src/shared test/unit test/e2e test/network docs; do
  if [ -d "$PROJECT_DIR/$d" ]; then
    ok "$d"
  else
    err "$d"
  fi
done
echo "  服务端依赖:"
if [ -d "$PROJECT_DIR/src/server/node_modules" ]; then
  ok "src/server/node_modules"
else
  warn "src/server/node_modules (首次启 start.sh 会自动 npm install)"
fi
echo ""

# ============= [2/8] Node.js =============
echo -e "${BLUE}[2/8]${NC} Node.js"
if command -v node &> /dev/null; then
  ok "node: $(node --version)"
  ok "路径: $(which node)"
else
  err "node 不在 PATH 中"
  info "常见位置(自动装时这里):"
  [ -x "/opt/homebrew/opt/node/bin/node" ] && info "  /opt/homebrew/opt/node/bin/node (Apple Silicon Homebrew)"
  [ -x "/usr/local/bin/node" ] && info "  /usr/local/bin/node (Intel Homebrew)"
  [ -d "$HOME/.nvm/versions/node" ] && info "  ~/.nvm/versions/node/ (NVM)"
fi
echo ""

# ============= [3/8] Python =============
echo -e "${BLUE}[3/8]${NC} Python"
if command -v python3 &> /dev/null; then
  ok "python3: $(python3 --version 2>&1 | awk '{print $2}')"
  ok "路径: $(which python3)"
elif command -v python &> /dev/null; then
  ok "python: $(python --version 2>&1 | awk '{print $2}')"
  ok "路径: $(which python)"
else
  err "python 不在 PATH 中"
fi
echo ""

# ============= [4/8] 包管理器 =============
echo -e "${BLUE}[4/8]${NC} 包管理器"
if command -v brew &> /dev/null; then
  ok "brew: $(brew --version | head -1)"
else
  warn "brew 不可用 (没装 Homebrew,装 node/python 需要手动下)"
fi
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  ok "NVM: 已装 (~/$(realpath --relative-to=$HOME $HOME/.nvm/nvm.sh 2>/dev/null || echo .nvm)/nvm.sh)"
else
  info "NVM 未装"
fi
echo ""

# ============= [5/8] 端口占用 =============
echo -e "${BLUE}[5/8]${NC} 端口占用"
for port in 8080 9000; do
  if lsof -iTCP:$port -sTCP:LISTEN &> /dev/null; then
    warn "端口 $port 被占用"
    lsof -iTCP:$port -sTCP:LISTEN | tail -1 | awk '{print "    " $0}'
  else
    ok "端口 $port 空闲"
  fi
done
echo ""

# ============= [6/8] 网络到 TURN =============
echo -e "${BLUE}[6/8]${NC} 网络到 Metered TURN 服务器"
if ping -c 2 -W 3 global.relay.metered.ca &> /dev/null; then
  ok "可达 global.relay.metered.ca"
else
  err "不可达 global.relay.metered.ca"
  info "可能 GFW / 防火墙阻挡"
fi
echo ""

# ============= [7/8] 系统信息 =============
echo -e "${BLUE}[7/8]${NC} 系统信息"
echo "  操作系统: $(uname -srm)"
echo "  macOS 版本: $(sw_vers -productVersion 2>/dev/null || echo '(非 Mac)')"
echo "  Shell: $SHELL"
echo ""

# ============= [8/8] PATH 节选 =============
echo -e "${BLUE}[8/8]${NC} PATH 节选(只列含 node/python/brew/nvm 的)"
echo "$PATH" | tr ':' '\n' | grep -iE "node|python|brew|nvm" | sed 's/^/  /' || echo "  (无)"
echo ""

echo "============================================================"
echo -e "  ${GREEN}诊断完成${NC}"
echo "============================================================"
echo ""
echo "  操作:全选这个窗口的内容,复制,贴给开发者"
echo "  或者重定向:./diagnose.sh > diagnose-output.txt"
echo ""
