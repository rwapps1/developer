// Renders the login/signup screen.


  function renderLogin() {
    const app = document.getElementById('app');
    const isSignup = state.authMode === 'signup';

    app.innerHTML = `
      <div class="screen login-screen bg-login">
        <div class="wrap">
          <div class="header-row">
            <span class="badge"></span>
            <h1>Pal<span class="wordmark-accent">a</span>bra</h1>
          </div>
          <p class="sub">Your progress, wherever you play</p>

          <div class="prompt-card">
            <div class="auth-tabs">
              <button class="auth-tab ${!isSignup ? 'active' : ''}" id="tab-signin" type="button">Sign in</button>
              <button class="auth-tab ${isSignup ? 'active' : ''}" id="tab-signup" type="button">Create account</button>
            </div>

            ${state.authError ? `<div class="msg-error">${esc(state.authError)}</div>` : ''}
            ${state.authInfo ? `<div class="msg-ok">${esc(state.authInfo)}</div>` : ''}

            <label class="settings-label" for="auth-email">Email</label>
            <input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" />

            <div id="username-field" class="${isSignup ? 'shown' : ''}">
              <label class="settings-label" for="auth-username">Username</label>
              <input type="text" id="auth-username" placeholder="How friends will find you" autocomplete="off" />
            </div>

            <label class="settings-label" for="auth-password">Password</label>
            <input type="password" id="auth-password" placeholder="••••••••" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />

            ${!isSignup ? `<button class="link-btn" id="forgot-password-btn" type="button">Forgot password?</button>` : ''}

            <div id="confirm-field" class="${isSignup ? 'shown' : ''}">
              <label class="settings-label" for="auth-confirm">Confirm password</label>
              <input type="password" id="auth-confirm" placeholder="••••••••" />
            </div>

            <button class="btn-primary" id="auth-submit-btn" ${state.authBusy ? 'disabled' : ''} type="button">
              ${state.authBusy ? 'Please wait…' : (isSignup ? 'Create account' : 'Sign in')}
            </button>

            <div class="auth-divider">or</div>

            <button class="btn-secondary" id="auth-google-btn" ${state.authBusy ? 'disabled' : ''} type="button">
              <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
          </div>

          <div class="dev-contact">
            <img src="dev-logo.png" alt="Rwapps1" />
            <a class="dev-contact-link" href="https://t.me/Rwapps1" target="_blank" rel="noopener noreferrer">
              <span class="tg-icon"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M21.05 2.93a1 1 0 00-1.06-.2L2.4 10.36a1 1 0 00.03 1.85l4.9 1.9 1.9 5.98a1 1 0 001.77.27l2.55-3.3 4.6 3.4a1 1 0 001.58-.6l3-15.4a1 1 0 00-.68-1.13zM9.9 14.3l-.1 3-1.4-4.4 9.9-6.9L9.9 14.3z"/></svg></span>
              Live Chat on Telegram
            </a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('tab-signin').addEventListener('click', () => {
      state.authMode = 'signin'; state.authError = ''; state.authInfo = ''; render();
    });
    document.getElementById('tab-signup').addEventListener('click', () => {
      state.authMode = 'signup'; state.authError = ''; state.authInfo = ''; render();
    });
    document.getElementById('auth-submit-btn').addEventListener('click', handleAuthSubmit);
    document.getElementById('auth-google-btn').addEventListener('click', handleGoogleSignIn);
    const forgotBtn = document.getElementById('forgot-password-btn');
    if (forgotBtn) forgotBtn.addEventListener('click', handleForgotPassword);
  }
