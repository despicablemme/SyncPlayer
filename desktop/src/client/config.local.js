// SyncPlay - 本地 TURN/STUN 配置(覆盖 template)
// ============================================
// 🚨 此文件包含真实凭据,已被 .gitignore 忽略,不会被提交
// 🚨 不要修改 .gitignore 让它入库!
// 🚨 如果你不小心提交了,立即轮换 TURN 凭据
// ============================================

window.SYNCPLAY_ICE_SERVERS = [
  // STUN(用于直连,不需认证)
  { urls: 'stun:global.relay.metered.ca:80' },

  // TURN(用于穿透失败时的中继) — 真凭据
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'b0492bd983a1c50073ce4665',
    credential: 'xwemyMUZMt8ac/1u'
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'b0492bd983a1c50073ce4665',
    credential: 'xwemyMUZMt8ac/1u'
  },
  {
    urls: 'turns:global.relay.metered.ca:443',
    username: 'b0492bd983a1c50073ce4665',
    credential: 'xwemyMUZMt8ac/1u'
  }
];
