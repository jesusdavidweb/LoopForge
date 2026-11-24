import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { loadApp, settle, WEB_ROOT } from '../lib/load-app.mjs';

const HAN = /[\u3400-\u9fff]/;
const ATTRS = ['placeholder', 'title', 'aria-label', 'aria-description', 'aria-valuetext', 'alt', 'label', 'data-tip', 'data-tooltip'];

// A page in English mode: i18n.js rewrites the Chinese copy with i18n-en.js.
async function englishPage(html, language = 'en') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://127.0.0.1/' });
  dom.window.localStorage.setItem('loopforge.lang', language);
  dom.window.matchMedia = () => ({ matches: false });
  for (const file of ['boot.js', 'i18n-en.js', 'i18n.js']) {
    new vm.Script(await readFile(path.join(WEB_ROOT, file), 'utf8'), { filename: file }).runInContext(dom.getInternalVMContext());
  }
  return dom.window;
}

function leftoverChinese(roots) {
  const left = [];
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('[data-i18n-skip], [data-i18n-data], script, style, code, pre')) continue;
      for (const node of el.childNodes) if (node.nodeType === 3 && HAN.test(node.nodeValue)) left.push(node.nodeValue.trim());
      for (const name of ATTRS) {
        const value = el.getAttribute(name);
        if (value && HAN.test(value)) left.push(`${name}="${value}"`);
      }
    }
  }
  return left;
}

test('English mode leaves no Chinese in the navigation, the top bar or the 个人配置 heading', async () => {
  const window = await englishPage(await readFile(path.join(WEB_ROOT, 'index.html'), 'utf8'));
  const { document } = window;
  const roots = [...document.querySelectorAll('#platformRail, #settingsSidebar, .topbar, #settingsView .page-heading')];
  assert.equal(roots.length, 4);
  assert.deepEqual(leftoverChinese(roots), []);
  assert.equal(document.querySelector('#settingsSidebar [data-view="settings"] .nav-label').textContent, 'Personal settings');
  assert.equal(document.querySelector('#platformRail [data-view="observability"]').dataset.tooltip, 'Usage');
  window.close();
});

test('English translates the static shell and standalone pages', async (t) => {
  for (const file of ['index.html', 'login.html', 'bot-bind.html', 'bot-approve.html', 'gongfeng-oauth-done.html', 'vscode.html']) {
    await t.test(file, async () => {
      const window = await englishPage(await readFile(path.join(WEB_ROOT, file), 'utf8'));
      try {
        assert.ok(window.document.querySelector('script[src="/i18n.js"]'));
        assert.equal(window.document.documentElement.lang, 'en');
        assert.doesNotMatch(window.document.title, HAN);
        assert.deepEqual(leftoverChinese([window.document.body]), []);
      } finally {
        window.close();
      }
    });
  }
});

test('main views translate after rendering, including a dialog and a backend error toast', async (t) => {
  const app = await loadApp({ language: 'en', routes: [
    { path: '/api/localization-test', body: { error: '密码需 12–64 个字符' }, status: 400 },
  ] });
  t.after(app.close);
  for (const [view, root] of [
    ['issues', 'issuesView'], ['runs', 'runsView'], ['approvals', 'approvalsView'], ['sops', 'sopsView'],
    ['flow', 'flowView'], ['agents', 'agentsView'], ['mcp', 'mcpView'], ['sandboxes', 'assetsView'],
    ['observability', 'observabilityView'], ['projects', 'projectsView'], ['runners', 'runnersView'],
    ['settings', 'settingsView'], ['bots', 'botsView'], ['aiSchedules', 'aiSchedulesView'],
  ]) {
    app.evaluate(`switchView(${JSON.stringify(view)})`);
    await settle(4);
    const element = app.document.getElementById(root);
    assert.ok(element, root);
    assert.deepEqual(leftoverChinese([element]), [], view);
  }
  app.evaluate('void afConfirm({title: "删除凭据？", message: "此操作不可撤销", confirmText: "删除"})');
  await app.evaluate('api("/api/localization-test").catch(error => toast(error.message, "err"))');
  await settle(2);
  assert.equal(app.document.querySelector('#confirmTitle').textContent, 'Delete credential?');
  assert.equal(app.document.querySelector('.toast-item-msg').textContent, 'Password must contain 12–64 characters');
});

test('late attributes and labels translate without modifying user content, identifiers, or interpolation values', async (t) => {
  const window = await englishPage('<html><head><title>LoopForge</title></head><body></body></html>');
  t.after(() => window.close());
  const { document } = window;
  document.body.innerHTML = `
    <select><optgroup label="本项目沙箱"><option value="配置">进入配置</option><option>查看详情</option></optgroup></select>
    <textarea placeholder="搜索项目">删除</textarea><p data-i18n-data>删除凭据？</p>
    <div class="user-bubble">删除</div><pre><span>安装 CLI</span></pre>
    <button></button>`;
  await settle(2);
  const button = document.querySelector('button');
  button.setAttribute('aria-description', '复制 SOP 名称');
  button.setAttribute('data-hui-title', '打开项目 配置，v2');
  button.textContent = '查看详情';
  document.title = 'LoopForge 工作台';
  await settle(2);
  assert.equal(button.textContent, 'View details');
  assert.equal(button.getAttribute('aria-description'), 'Copy SOP name');
  assert.equal(button.dataset.huiTitle, 'Open project 配置，v2');
  assert.equal(document.title, 'LoopForge Workspace');
  assert.equal(document.querySelector('optgroup').label, 'Project sandboxes');
  assert.equal(document.querySelector('select').value, '配置');
  assert.equal(document.querySelector('option:last-child').value, '查看详情');
  assert.equal(document.querySelector('option:last-child').textContent, 'View details');
  assert.equal(document.querySelector('textarea').placeholder, 'Search projects');
  assert.equal(document.querySelector('textarea').value, '删除');
  assert.deepEqual([...document.querySelectorAll('[data-i18n-data], .user-bubble, pre')].map(el => el.textContent),
    ['删除凭据？', '删除', '安装 CLI']);
});

test('the English date picker localizes weekdays and months while submitting the original date format', async (t) => {
  const app = await loadApp({ language: 'en', dispatchReady: false });
  t.after(app.close);
  const input = app.document.createElement('input');
  input.type = 'date';
  input.value = '2026-10-15';
  app.document.body.append(input);
  const picker = app.window.HuiDate.enhance(input);
  picker.trigger.click();
  await settle(2);
  assert.equal(picker.trigger.getAttribute('aria-label'), 'Select date: 2026-10-15');
  assert.equal(picker.panel.querySelector('.hui-date-title').textContent, 'October 2026');
  assert.deepEqual([...picker.panel.querySelectorAll('.hui-date-weekday')].map(day => day.textContent),
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  picker.panel.querySelector('[data-date="2026-10-16"]').click();
  assert.equal(input.value, '2026-10-16');
});

test('Chinese stays unchanged and the switcher still stores selection and updates its radios', async (t) => {
  const window = await englishPage(await readFile(path.join(WEB_ROOT, 'login.html'), 'utf8'), 'zh');
  t.after(() => window.close());
  await settle(2);
  const { document } = window;
  const zh = document.querySelector('[data-lang-value="zh"]');
  const en = document.querySelector('[data-lang-value="en"]');
  assert.equal(document.documentElement.lang, 'zh-CN');
  assert.equal(zh.textContent, '中');
  assert.equal(document.querySelector('#loginSubmit').textContent.trim(), '登录');
  assert.equal(zh.getAttribute('aria-checked'), 'true');
  assert.equal(en.getAttribute('aria-checked'), 'false');
  en.click();
  assert.equal(window.localStorage.getItem('loopforge.lang'), 'en');
  assert.equal(zh.getAttribute('aria-checked'), 'false');
  assert.equal(en.getAttribute('aria-checked'), 'true');
  assert.equal(document.documentElement.lang, 'zh-CN');
});

test('English displays English language labels and a supported Bot link command', async (t) => {
  const window = await englishPage(await readFile(path.join(WEB_ROOT, 'login.html'), 'utf8'));
  t.after(() => window.close());
  await settle(2);
  const { document } = window;
  assert.equal(document.querySelector('#loginLang').getAttribute('aria-label'), 'Language');
  const chinese = document.querySelector('[data-lang-value="zh"]');
  assert.equal(chinese.textContent, 'ZH');
  assert.equal(chinese.getAttribute('aria-label'), 'Chinese');
  assert.equal(document.querySelectorAll('[data-lang-value]').length, 2);
  assert.equal(window.lfTranslate('请回到聊天中，向机器人发送“绑定账号”获取新链接。'),
    'Return to the chat and send /bind to the bot for a new link.');
  const translationsWithChinese = Object.entries(window.LF_I18N_EN)
    .filter(([, translation]) => HAN.test(translation))
    .map(([source]) => source);
  assert.deepEqual(translationsWithChinese, []);
});

test('English mode translates every page title and the copy the app renders into the navigation', async (t) => {
  const app = await loadApp({ dispatchReady: false });
  t.after(app.close);
  const window = await englishPage('<html><body></body></html>');
  const titles = app.evaluate('viewTitles()');
  const untranslated = Object.entries(titles).filter(([, zh]) => HAN.test(window.lfTranslate(zh)));
  assert.deepEqual(untranslated, []);
  for (const text of ['收起设置导航', '展开设置导航', '收起导航', '展开导航', '返回首页', '拖动调整侧栏宽度，双击恢复默认', '调整侧栏宽度',
    'alice (alice) · 点击查看个人信息', '当前为访客身份 · 点击查看个人信息', '认证换票未通过 · 点击查看个人信息']) {
    assert.doesNotMatch(window.lfTranslate(text), HAN, text);
  }
  window.close();
});

test('English mode translates the 个人配置 credential panel and the hints that point to it', async (t) => {
  const app = await loadApp({ dispatchReady: false });
  t.after(app.close);
  const window = await englishPage('<html><body></body></html>');
  const panel = window.document.createElement('div');
  panel.innerHTML = app.evaluate('credentialPanelHTML({})');
  window.document.body.append(panel);
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  assert.deepEqual(leftoverChinese([panel]), []);
  for (const text of ['需由责任人本人在个人配置中配置', '个人配置 · 一次配齐', '打开个人配置 →', 'CodeBuddy 使用个人配置中保存的 API Key',
    '到个人配置补充 Codex API Key', '将使用个人配置中的 API 凭证', '已切换；请先到个人配置补充该 CLI 的 API Key', '去个人配置配置',
    '请先在个人配置中配置自己的 CodeBuddy API Key', '请先配置个人 CodeBuddy API Key',
    '使用仓库进行需求分析、访问私有代码或提交 PR 前，请先配置 Git 访问令牌。SOP 使用需求责任人的 Token，未指定时使用项目 Owner 的 Token。',
    // The shared-key refusal lists the allowed models, so only its two sentences are in the dictionary.
    '未配置个人 CodeBuddy API Key 时只能使用平台管理员允许的模型（glm-5.1、kimi-k2.6）。要使用其他模型，请先在个人配置中配置自己的 CodeBuddy API Key']) {
    assert.doesNotMatch(window.lfTranslate(text), HAN, text);
  }
  assert.equal(window.lfTranslate('未配置个人 CodeBuddy API Key 时只能使用平台管理员允许的模型（glm-5.1、kimi-k2.6）。要使用其他模型，请先在个人配置中配置自己的 CodeBuddy API Key'),
    'Without a personal CodeBuddy API key you can only use the models a platform admin allowed (glm-5.1, kimi-k2.6). To use other models, set your own CodeBuddy API key in Personal settings first');
  window.close();
});
