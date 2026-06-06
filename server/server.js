/**
 * SyncPlay - PeerJS 私有信令服务器
 *
 * 用途：替换 PeerJS 官方公共服务器（0.peerjs.com），自建以获得：
 *   1. 可控的部署位置（不依赖外网公共服务器）
 *   2. 自定义鉴权 / 房间白名单
 *   3. 日志和监控
 *
 * 启动：node server.js
 * 默认端口：9000
 *
 * 客户端配置（在 app.js 中）：
 *   PEER_HOST: 'localhost'
 *   PEER_PORT: 9000
 *   PEER_SECURE: false
 */

const { PeerServer } = require('peer');

const PORT = process.env.PEER_PORT || 9000;
const PATH = process.env.PEER_PATH || '/';

const server = PeerServer({
  port: PORT,
  path: PATH,
  proxied: false,
  allow_discovery: true,
  // 简单的存活检测
  alive_timeout: 60000,
  // 鉴权占位（生产环境应当配合 JWT 或共享密钥）
  // auth: (req, res, cb) => cb(null, true),
});

// 监控日志
server.on('connection', (client) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] + peer connected: ${client.getId()}`);
});

server.on('disconnect', (client) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] - peer disconnected: ${client.getId()}`);
});

const ts = new Date().toISOString();
console.log(`[${ts}] SyncPlay PeerJS server listening on http://localhost:${PORT}${PATH}`);

// 优雅退出
function shutdown(signal) {
  console.log(`\n[${new Date().toISOString()}] 收到 ${signal}，关闭服务器...`);
  server.stop(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
  // 强制退出
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
