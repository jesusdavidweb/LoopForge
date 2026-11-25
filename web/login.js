document.getElementById('loginTheme').onclick = () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('agentflow.theme.v3', next);
};

const $ = id => document.getElementById(id);
const t = window.lfMessage;
let mode = 'login', signup = false;

function render() {
  const creating = mode !== 'login';
  $('loginSubtitle').textContent = mode === 'setup' ? t('auth.setupSubtitle') : creating ? t('auth.signUpSubtitle') : t('auth.signInSubtitle');
  $('setupNotice').hidden = mode !== 'setup';
  $('confirmField').hidden = !creating;
  $('passwordRule').hidden = !creating;
  $('loginForm').elements.confirm.required = creating;
  $('loginForm').elements.password.autocomplete = creating ? 'new-password' : 'current-password';
  $('loginSubmit').textContent = mode === 'setup' ? t('auth.createAndContinue') : creating ? t('auth.registerAndContinue') : t('auth.signIn');
  $('loginSwitch').hidden = mode === 'setup' || !signup;
  $('switchText').textContent = creating ? t('auth.existingAccount') : t('auth.noAccount');
  $('switchMode').textContent = creating ? t('auth.signIn') : t('auth.signUp');
  $('loginContact').hidden = mode === 'setup' || signup;
  $('loginError').textContent = '';
}

$('switchMode').onclick = () => { mode = mode === 'login' ? 'register' : 'login'; render(); };

fetch('/api/auth/setup')
  .then(response => response.ok ? response.json() : null)
  .catch(() => null)
  .then(state => {
    if (!state) {
      $('loginContact').hidden = false;
      return;
    }
    signup = !!state.signupEnabled;
    if (state.needsSetup) mode = 'setup';
    else if (location.hash === '#register' && signup) mode = 'register';
    render();
  });

$('loginForm').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget, button = $('loginSubmit'), error = $('loginError');
  const creating = mode !== 'login';
  if (creating && form.elements.password.value !== form.elements.confirm.value) {
    error.textContent = t('auth.passwordMismatch');
    return;
  }
  button.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch(creating ? '/api/auth/register' : '/api/auth/password', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({login: form.elements.login.value.trim(), password: form.elements.password.value}),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || t('auth.requestFailed'));
    location.replace('/');
  } catch (err) { error.textContent = err.message; button.disabled = false; }
};
