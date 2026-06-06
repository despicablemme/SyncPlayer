#!/usr/bin/env node

// SyncPlay UI 测试 - 使用系统 Chrome
const { chromium } = require('playwright');
const path = require('path');

async function runTest() {
  console.log('🚀 开始 SyncPlay UI 测试...');

  // 使用系统安装的 Chrome
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false  // 需要能看到浏览器
  });

  try {
    // 用户 A 页面
    const pageA = await browser.newPage();
    const filePathA = 'file://' + path.resolve(__dirname, '../client/index.html');
    await pageA.goto(filePathA);
    console.log('✅ 用户A页面已打开');

    // 用户 B 页面
    const pageB = await browser.newPage();
    const filePathB = 'file://' + path.resolve(__dirname, '../client/index.html');
    await pageB.goto(filePathB);
    console.log('✅ 用户B页面已打开');

    // A：点击创建房间按钮
    const createBtnA = await pageA.$('#createBtn');
    if (createBtnA) {
      await createBtnA.click();
      console.log('✅ 用户A点击了创建房间');
    } else {
      console.log('❌ 找不到创建房间按钮');
    }

    // 等待 PeerJS 初始化（可能需要5秒）
    console.log('等待 PeerJS 初始化...');
    await pageA.waitForTimeout(5000);

    // 检查房间号是否显示
    const roomInfoDisplay = await pageA.$eval('#roomInfo', el => el.style.display).catch(() => 'none');
    console.log('房间信息显示状态:', roomInfoDisplay);

    const roomIdA = await pageA.$eval('#myRoomId', el => el.textContent).catch(() => null);
    
    if (!roomIdA) {
      console.log('❌ 用户A未能生成房间号');
      return;
    }
    console.log('📝 房间号:', roomIdA);

    // B：输入房间号并加入
    await pageB.fill('#roomIdInput', roomIdA);
    const joinBtnB = await pageB.$('#joinBtn');
    if (joinBtnB) {
      await joinBtnB.click();
      console.log('✅ 用户B点击了加入房间');
    }

    // 等待连接建立
    await pageA.waitForTimeout(3000);

    // 验证连接状态
    const statusA = await pageA.$eval('#remoteStatus', el => el.textContent).catch(() => '未知');
    const statusB = await pageB.$eval('#remoteStatus', el => el.textContent).catch(() => '未知');

    console.log('用户A看到对方状态:', statusA);
    console.log('用户B看到对方状态:', statusB);

    // 检查是否连接成功
    const success = statusA.includes('已连接') && statusB.includes('已连接');
    console.log('\n========== 测试结果 ==========');
    console.log(success ? '✅ 通过：双方连接成功！' : '❌ 失败：未能建立连接');
    console.log('==============================\n');

    // 保持浏览器打开5秒让用户确认
    console.log('浏览器将保持打开5秒...');
    await pageA.waitForTimeout(5000);

  } catch (error) {
    console.error('测试出错:', error.message);
  } finally {
    await browser.close();
    console.log('测试结束');
  }
}

runTest();
