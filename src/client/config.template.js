// SyncPlay - TURN/STUN 配置模板
// ============================================
// 📌 用途:提供 ICE servers 的占位符配置。
// 📌 加载顺序(在 index.html 中):
//      1. config.local.js   ← 可选,本地覆盖(放真凭据,git 忽略)
//      2. config.template.js ← 本文件,提供默认值
//      3. app.js            ← 使用 window.SYNCPLAY_ICE_SERVERS
// 📌 工作原理:
//      - 如果 config.local.js 先加载,window.SYNCPLAY_ICE_SERVERS 已被赋值
//      - 本文件用 `||=` 语义:已存在则不覆盖,不存在才用占位符
//      - 所以"有 local 就用 local,没有就用 template"
// ============================================

window.SYNCPLAY_ICE_SERVERS = window.SYNCPLAY_ICE_SERVERS || [
  // STUN(用于直连,不需认证)
  { urls: 'stun:global.relay.metered.ca:80' },

  // TURN(用于穿透失败时的中继)
  // ⚠️ 占位符:在 https://www.metered.ca 注册后,把 username/credential 填到 config.local.js
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: '__TURN_USERNAME__',
    credential: '__TURN_CREDENTIAL__'
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: '__TURN_USERNAME__',
    credential: '__TURN_CREDENTIAL__'
  },
  {
    urls: 'turns:global.relay.metered.ca:443',
    username: '__TURN_USERNAME__',
    credential: '__TURN_CREDENTIAL__'
  }
];

// ============================================
// 🛠️ 本地开发者:如何填真凭据
// ============================================
// 1. 复制本文件为 config.local.js:
//      cp config.template.js config.local.js
// 2. 编辑 config.local.js,把 __TURN_USERNAME__ / __TURN_CREDENTIAL__ 替换为真值
// 3. config.local.js 已被 .gitignore 忽略,不会污染仓库
// 4. 如果 config.local.js 不存在,浏览器会报 404 警告(可忽略),
//    自动 fallback 到本文件的占位符
// ============================================
