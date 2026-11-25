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
  await page.goto('/?localization-test=1#/settings');
  let githubAvailable = false;
  await page.route('**/api/auth/github', route => route.fulfill(githubAvailable
    ? {json:{enabled:true}}
    : {status:503,json:{error:'Unavailable'}}));
  const gitMenu = page.locator('[data-credential-add-menu=platform]');
  await gitMenu.selectOption('gitToken', {force:true});
  const credentialWizard = page.locator('#credentialWizard');
  await expect(credentialWizard.getByRole('status').filter({hasText:'Could not check authorization availability'})).toBeVisible();
  await expect.poll(() => unlocalized(credentialWizard)).toEqual([]);
  githubAvailable = true;
  await credentialWizard.getByRole('button', {name:'Check again', exact:true}).click();
  await expect(credentialWizard.getByRole('button', {name:'Connect GitHub', exact:true})).toBeEnabled();
  await expect.poll(() => unlocalized(credentialWizard)).toEqual([]);
  await credentialWizard.getByRole('tab', {name:'Access token', exact:true}).click();
  await expect(credentialWizard.getByText('Use an access token', {exact:true})).toBeVisible();
  await expect.poll(() => unlocalized(credentialWizard)).toEqual([]);
  await credentialWizard.locator('#credentialWizardSecret').fill('demo-token-for-display-only');
  await credentialWizard.locator('[data-wizard-next]').click();
  await expect(credentialWizard.getByRole('button', {name:'Verify and save'})).toBeVisible();
  await expect.poll(() => unlocalized(credentialWizard)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(credentialWizard).toBeHidden();

  for (const [value, dialogID] of [
    ['gitSshKey', 'gitSSHKeyDialog'],
    ['github', 'gitHTTPCredentialDialog'],
    ['gitlab', 'gitHTTPCredentialDialog'],
    ['other', 'gitHTTPCredentialDialog'],
  ]) {
    await gitMenu.selectOption(value, {force:true});
    const gitDialog = page.locator('#' + dialogID);
    await expect(gitDialog.locator('form')).toBeVisible();
    await expect.poll(() => unlocalized(gitDialog)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(gitDialog).toBeHidden();
  }

  const executors = page.locator('[data-credential-add-menu=model]');
  const executorIDs = await executors.locator('option:not([disabled])').evaluateAll(options => options.map(option => option.value));
  expect(executorIDs.length).toBeGreaterThan(0);
  for (const id of executorIDs) {
    await executors.selectOption(id, {force:true});
    await credentialWizard.getByText('How to get an API key', {exact:true}).click();
    await expect.poll(() => unlocalized(credentialWizard), {message:id}).toEqual([]);
    const labels = await credentialWizard.locator('select:visible option').allTextContents();
    expect(labels.join(' '), id).not.toMatch(/\p{Script=Han}/u);
    await page.keyboard.press('Escape');
    await expect(credentialWizard).toBeHidden();
  }

  await page.evaluate(() => {
    // Render a configured credential without storing or transmitting a token.
    const user = credentialUser();
    storeCredentialUser({...user, gitHubCredentialConfigured:true});
    renderPersonalSettings();
  });
  const verifyGit = page.locator('[data-credential-row=gitToken]').getByRole('button', {name:'Verify again', exact:true});
  await verifyGit.hover();
  await expect.poll(() => verifyGit.evaluate(button => {
    const tooltip = getComputedStyle(button.closest('.credential-tip'), '::after');
    return [tooltip.content, tooltip.opacity];
  })).toEqual(['"Verify again"', '1']);
  await page.mouse.move(800, 30);

  const runnerFixture = {
    id:'localization-runner', name:'Localization test runner', ownerUserId:1,
    status:'online', os:'darwin', arch:'arm64', runLimit:2, lastSeenAt:new Date().toISOString(),
    runtimes:[
      {provider:'claude-code', status:'online', authMode:'local', version:'1.0'},
      {provider:'claude-code', status:'online', authMode:'personal', version:'1.0'},
      {provider:'codex', status:'online', authMode:'personal', version:'1.0'},
    ],
  };
  let runnerAuth = 'local';
  await page.route('**/api/runners?mine=1', route => route.fulfill({
    json:[{...runnerFixture,runtimes:runnerFixture.runtimes.filter(runtime => runtime.authMode === runnerAuth)}],
  }));
  await page.goto('/#/runners');
  const authHelp = page.getByRole('button', {name:'About model authentication', exact:true});
  await expect(authHelp).toHaveText('Model authentication');
  await authHelp.click();
  const runnerDialog = page.locator('#confirmModal');
  await expect(runnerDialog).toContainText('Model authentication methods');
  await expect.poll(() => unlocalized(runnerDialog)).toEqual([]);
  await page.locator('#confirmOkBtn').click();

  for (const [mode, emptyLabel] of [['local', 'Use models from the runner’s account'], ['personal', 'Use Claude Code built-in models']]) {
    runnerAuth = mode;
    await page.reload();
    await page.locator('[data-runner-runtime-menu="localization-runner|claude-code"]').click();
    await page.locator('.runner-runtime-menu').getByRole('menuitem', {name:'Model list',exact:true}).click();
    await expect(runnerDialog.getByText(emptyLabel, {exact:true})).toBeVisible();
    await expect(runnerDialog.getByRole('button', {name:'Fetch available models'})).toBeVisible();
    await expect.poll(() => unlocalized(runnerDialog), {message:mode}).toEqual([]);
    await runnerDialog.getByRole('button', {name:'Add model'}).click();
    await expect(runnerDialog.getByRole('textbox', {name:'Model ID',exact:true})).toBeVisible();
    await expect.poll(() => unlocalized(runnerDialog)).toEqual([]);
    await page.locator('#confirmCancelBtn').click();
  }

  await page.route('**/api/runners/runtimes/test', route => route.fulfill({
    status:400, json:{
      code:'runner_api_key_required',
      error:'请先在个人配置中配置 Claude Code API Key 后再使用 Claude Code 模型',
    },
  }));
  await page.locator('[data-runner-runtime-menu="localization-runner|claude-code"]').click();
  await page.locator('.runner-runtime-menu').getByRole('menuitem', {name:'Testing',exact:true}).click();
  await expect(page.getByText('Claude Code: Add an API key in Personal settings, or use Account sign-in on this runner if the CLI supports it.', {exact:true})).toBeVisible();

  await page.route('**/api/users/*/cli-models/probe', route => route.fulfill({
    json:{source:'builtin',models:[{id:'demo-model',name:'Demo model'}]},
  }));
  await page.locator('[data-runner-runtime-menu="localization-runner|codex"]').click();
  await page.locator('.runner-runtime-menu').getByRole('menuitem', {name:'Model list',exact:true}).click();
  await runnerDialog.getByRole('button', {name:'Test connection',exact:true}).click();
  await expect(runnerDialog.getByText('Showing built-in models. Add an API key in Personal settings to test the API connection.', {exact:true})).toBeVisible();
  await page.locator('#confirmCancelBtn').click();

  let finishUpdateCheck;
  const updateResponse = new Promise(resolve => { finishUpdateCheck = resolve; });
  await page.route('**/api/runners/localization-runner/maintenance', async route => {
    await updateResponse;
    await route.fulfill({json:{status:'current',current:'1.0'}});
  });
  const update = page.locator('[data-runner-check-update=localization-runner]');
  await update.click();
  try {
    await expect(update).toHaveText('Checking for updates…');
    await expect(update).toHaveAttribute('aria-disabled', 'true');
  } finally {
    finishUpdateCheck();
  }
  await expect(update).toHaveText('Check for updates');

  await page.goto('/#/sandboxes/new');
  const sandboxForm = page.locator('#assetForm');
  await expect(sandboxForm.locator('#assetDockerfile')).toBeVisible();
  await expect.poll(() => unlocalized(page.locator('#assetsView'))).toEqual([]);
  const isolation = sandboxForm.locator('select[name=driver]');
  await expect(isolation.locator('option')).toHaveText(['Docker','Lightweight system isolation']);
  await isolation.selectOption('native', {force:true});
  await expect(sandboxForm.locator('[data-sandbox-drivers=native]')).toBeVisible();
  await expect.poll(() => unlocalized(page.locator('#assetsView'))).toEqual([]);

  await page.goto('/?localization-test=2#/projectCredentials');
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
