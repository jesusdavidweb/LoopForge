import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const catalog = readFileSync(new URL('../../web/i18n-en.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../web/i18n.js', import.meta.url), 'utf8');

function load(language) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
  dom.window.document.documentElement.dataset.lang = language;
  dom.window.eval(catalog);
  dom.window.eval(runtime);
  return dom;
}

test('keyed messages supply both languages with the same named parameters', () => {
  const dom = load('en');
  try {
    const parameters = message => [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const [key, pair] of Object.entries(dom.window.LF_MESSAGES)) {
      assert.equal(pair.length, 2, key);
      assert.match(pair[0], /\p{Script=Han}/u, key);
      assert.doesNotMatch(pair[1], /\p{Script=Han}/u, key);
      assert.deepEqual(parameters(pair[0]), parameters(pair[1]), key);
    }
    assert.equal(dom.window.lfMessage('delivery.weekly', { delivered: 1200, people: 0 }),
      'Last 7 days: 1,200 delivered / 0 contributors');
    assert.equal(dom.window.lfMessage('project.open', { name: '我的项目' }), 'Open project 我的项目');
  } finally {
    dom.window.close();
  }
});

test('the demo project localizes known values while preserving edited values', () => {
  const english = load('en');
  const chinese = load('zh');
  try {
    const official = { id: 'welcome', name: 'LoopForge 体验项目' };
    assert.equal(english.window.lfProjectDisplay(official, 'name'), 'LoopForge demo project');
    assert.equal(chinese.window.lfProjectDisplay(official, 'name'), official.name);
    assert.equal(english.window.lfProjectDisplay({ ...official, name: '我的项目' }, 'name'), '我的项目');
    assert.equal(english.window.lfProjectDisplay({ ...official, id: 'another-project' }, 'name'), official.name);
  } finally {
    english.window.close();
    chinese.window.close();
  }
});

test('keyed interface references resolve to catalog entries', () => {
  const dom = load('en');
  try {
    const files = [
      'web/i18n.js', 'web/login.html', 'web/login.js', 'web/app/mcp.js',
      'web/app/observability.js', 'web/app/projects.js', 'web/app/sops.js',
      'chatbot/src/QuickAccessWizard.jsx'
    ];
    for (const file of files) {
      const source = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
      const direct = [...source.matchAll(/(?:lfMessage(?:\?\.)?|stepMessage)\(\s*['"]([.a-zA-Z-]+)['"]/g)];
      const declared = [...source.matchAll(/data-lf-text="([.a-zA-Z-]+)"/g)];
      const login = file === 'web/login.js' ? [...source.matchAll(/\bt\('(auth\.[a-zA-Z]+)'\)/g)] : [];
      for (const [, key] of [...direct, ...declared, ...login]) {
        assert.ok(Object.hasOwn(dom.window.LF_MESSAGES, key), file + ' references ' + key);
      }
    }
  } finally {
    dom.window.close();
  }
});
