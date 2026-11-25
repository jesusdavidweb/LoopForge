import {expect, test} from '@playwright/test';
import {appReady, chat, password, switchProject} from './helpers.mjs';

const unlocalized = async root => root.evaluate(scope => {
  const han = /\p{Script=Han}/u;
  const ignored = '[data-i18n-data], [data-i18n-skip], code, pre, .markdown-body, [contenteditable=true]';
  const attributes = ['title', 'aria-label', 'aria-description', 'aria-valuetext', 'placeholder', 'alt', 'data-tip', 'data-tooltip'];
  const hits = [];
  for (const element of [scope, ...scope.querySelectorAll('*')]) {
    if (element.closest(ignored) || !element.getClientRects().length ||
        getComputedStyle(element).visibility !== 'visible') continue;
    for (const name of attributes) {
      const value = element.getAttribute(name);
      if (value && han.test(value)) hits.push({ element:element.id || element.localName, name, value });
    }
    if (element.matches('textarea')) continue;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && han.test(node.textContent)) {
        hits.push({ element:element.id || element.localName, name:'text', value:node.textContent.trim() });
      }
    }
  }
  return hits;
});

test.use({reducedMotion:'reduce'});

test('localized desktop and mobile surfaces use English after changing the language', async ({page}, info) => {
  await page.goto('/login.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByLabel('用户名')).toBeVisible();
  await page.locator('#loginLang [data-lang-value="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.loopforge-build')).toHaveAttribute('title', /^Image version /);
  await page.locator('[name=login]').fill(process.env.LOOPFORGE_TEST_USER || 'admin');
  await page.locator('[name=password]').fill(password());
  await page.locator('#loginSubmit').click();
  await appReady(page);
  await switchProject(page, 'welcome');

  await page.goto('/#/observability');
  await page.locator('[data-obs-tab=delivery]').click();
  await expect(page.getByRole('heading', {name:'Delivery funnel'})).toBeVisible();
  await expect.poll(() => unlocalized(page.locator('#observabilityView'))).toEqual([]);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/#/assistant');
  await expect(page.getByText('Sending messages during generation', {exact:true})).toBeVisible();
  await expect.poll(() => unlocalized(page.locator('#assistantView'))).toEqual([]);

  for (const [id, labels] of [
    ['assistantPrefsMessageDuringGeneration', ['Queue', 'Send immediately']],
    ['assistantPrefsReviewMode', ['Use the current conversation’s CLI and model', 'Custom CLI and model', 'Custom API and model']],
  ]) {
    const trigger = page.locator('#' + id + ' + button.hui-select-trigger');
    await trigger.click();
    const panel = page.locator('[id="' + await trigger.getAttribute('aria-controls') + '"]');
    await expect(panel.getByRole('option')).toHaveText(labels);
    await expect.poll(() => unlocalized(panel)).toEqual([]);
    await page.screenshot({path:info.outputPath(id + '.png')});
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  }

  await page.goto('/#/projects');
  await page.locator('#newProject').click();
  const projectWizard = page.locator('#projectWizard');
  await projectWizard.locator('[data-pw-action=next]').click();
  await expect(projectWizard.getByRole('alert')).toHaveText('Enter a project name.');
  await page.screenshot({path:info.outputPath('project-name-required.png')});
  await page.goto('/?localization-test=1#/projectCredentials');
  await expect(page.locator('#projectCredentialsProject')).toHaveText('LoopForge demo project');

  await page.goto('/#/flow/welcome-workflow');
  await expect(page).toHaveURL(/#\/flow\/welcome-workflow$/);
  const scriptPreview = page.locator('#flowView .fd-tag.mono[data-i18n-data]').filter({hasText:/printf.*验收完成/});
  await expect(scriptPreview).toBeVisible();

  await page.goto('/#/collaboration');
  await page.locator('#userBadge').click();
  const appearance = page.locator('#userProfilePopover').getByRole('radiogroup', {name:'Appearance'});
  await expect(appearance.getByRole('radio')).toHaveText(['Light', 'Dark', 'System']);
  await expect.poll(() => unlocalized(appearance)).toEqual([]);
  await page.screenshot({path:info.outputPath('appearance-menu.png')});
  await page.keyboard.press('Escape');

  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/collaboration');
  await expect(chat(page).locator('html')).toHaveAttribute('lang', 'en');
  await expect(chat(page).getByRole('button', {name:/quick setup/i})).toBeVisible();

  await page.setViewportSize({width:1600,height:1000});
  await page.goto('/#/issues');
  await page.locator('#langToggle [data-lang-value="zh"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('.nav[data-view=issues]')).toHaveAttribute('aria-label', '需求列表');
});
