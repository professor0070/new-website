pages.auth = {
  renderLogin() {
    document.getElementById('app').innerHTML = `
      <div style="max-width: 400px; margin: 4rem auto;" class="glass-card fade-in">
        <h2 class="title text-gradient" style="text-align: center; font-size: 2rem;">Welcome Back</h2>
        <p class="subtitle" style="text-align: center; margin-bottom: 2rem;">Sign in to your AvatarX account</p>
        
        <form id="login-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" class="form-control" required placeholder="name@example.com">
          </div>
          <div class="form-group" style="position: relative;">
            <label>Password</label>
            <input type="password" id="password" class="form-control" required placeholder="••••••••" style="padding-right: 40px;">
            <button type="button" onclick="pages.auth.togglePassword('password')" style="position: absolute; right: 12px; top: 36px; background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px;">
              <i id="password-icon" data-lucide="eye" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
          <button type="submit" class="btn btn-primary btn-full">Sign In</button>
        </form>
        
        <div style="text-align: center; margin: 1.5rem 0; position: relative;">
          <hr style="border: 0; border-top: 1px solid var(--border-light); position: absolute; width: 100%; top: 50%;">
          <span style="color: var(--text-secondary); background: var(--bg-card); padding: 0 10px; position: relative; font-size: 0.9rem;">OR CONTINUE WITH</span>
        </div>
        
        <div id="google-login-btn" style="display:flex; justify-content:center; margin-bottom: 1rem;"></div>
        
        <button class="btn btn-secondary btn-full" onclick="pages.auth.requestOtp()">
          <i data-lucide="smartphone"></i> Use OTP Demo
        </button>
        
        <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary);">
          Don't have an account? <a href="#/signup">Sign up</a>
        </p>
        
        <div style="text-align: center; margin-top: 2rem;">
          <a href="#/admin-login" style="font-size: 0.8rem; color: rgba(255,255,255,0.3);"><i data-lucide="shield" style="width:12px; vertical-align:middle;"></i> Admin Portal Access</a>
        </div>
      </div>
    `;
    lucide.createIcons();
    this.initGoogleAuth();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const data = await api.post('/auth/login', { email, password });
        
        api.setToken(data.token);
        app.setUser(data.user);
        app.navigate('#/marketplace');
        ui.showToast('Logged in successfully', 'success');
      } catch (err) {
        // Error handled in api.js
      }
    });
  },

  renderAdminLogin() {
    document.getElementById('app').innerHTML = `
      <div style="max-width: 400px; margin: 4rem auto; border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 4px 40px rgba(239,68,68,0.1);" class="glass-card fade-in">
        <h2 class="title" style="text-align: center; font-size: 2rem; color: #f87171;"><i data-lucide="shield-alert" style="width:28px;"></i> System Access</h2>
        <p class="subtitle" style="text-align: center; margin-bottom: 2rem; color: #fca5a5;">Restricted Administrator Portal</p>
        
        <form id="admin-login-form">
          <div class="form-group">
            <label style="color: #fca5a5;">Admin Email</label>
            <input type="email" id="admin-email" class="form-control" style="border-color: rgba(239,68,68,0.3);" required placeholder="admin@avatarx.com">
          </div>
          <div class="form-group" style="position: relative;">
            <label style="color: #fca5a5;">Security Key (Password)</label>
            <input type="password" id="admin-password" class="form-control" style="border-color: rgba(239,68,68,0.3); padding-right: 40px;" required placeholder="••••••••">
            <button type="button" onclick="pages.auth.togglePassword('admin-password')" style="position: absolute; right: 12px; top: 36px; background: none; border: none; color: #fca5a5; cursor: pointer; padding: 4px;">
              <i id="admin-password-icon" data-lucide="eye" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
          <button type="submit" class="btn btn-full" style="background: rgba(239,68,68,0.2); color: #fecaca; border: 1px solid rgba(239,68,68,0.5);">Authorize Access</button>
        </form>
        
        <div style="text-align: center; margin-top: 2rem;">
          <a href="#/login" style="font-size: 0.8rem; color: var(--text-secondary);"><i data-lucide="arrow-left" style="width:12px; vertical-align:middle;"></i> Back to User Login</a>
        </div>
      </div>
    `;
    lucide.createIcons();

    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const data = await api.post('/auth/login', { email, password });
        
        if (data.user.role !== 'admin') {
          ui.showToast('Access Denied: Account lacks administrator privileges.', 'error');
          return;
        }

        api.setToken(data.token);
        app.setUser(data.user);
        app.navigate('#/admin');
        ui.showToast('Admin Authorized.', 'success');
      } catch (err) {
        // Error handled in api.js
      }
    });
  },

  renderSignup() {
    document.getElementById('app').innerHTML = `
      <div style="max-width: 400px; margin: 4rem auto;" class="glass-card fade-in">
        <h2 class="title text-gradient" style="text-align: center; font-size: 2rem;">Create Account</h2>
        <p class="subtitle" style="text-align: center; margin-bottom: 2rem;">Join the AvatarX community</p>
        
        <form id="signup-form">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="username" class="form-control" required placeholder="CoolAvatar99">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" class="form-control" required placeholder="name@example.com">
          </div>
          <div class="form-group" style="position: relative;">
            <label>Password</label>
            <input type="password" id="password" class="form-control" required placeholder="At least 6 characters" minlength="6" style="padding-right: 40px;">
            <button type="button" onclick="pages.auth.togglePassword('password')" style="position: absolute; right: 12px; top: 36px; background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px;">
              <i id="password-icon" data-lucide="eye" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
          <button type="submit" class="btn btn-primary btn-full">Create Account</button>
        </form>
        
        <div style="text-align: center; margin: 1.5rem 0; position: relative;">
          <hr style="border: 0; border-top: 1px solid var(--border-light); position: absolute; width: 100%; top: 50%;">
          <span style="color: var(--text-secondary); background: var(--bg-card); padding: 0 10px; position: relative; font-size: 0.9rem;">OR CONTINUE WITH</span>
        </div>
        <div id="google-login-btn" style="display:flex; justify-content:center; margin-bottom: 1rem;"></div>
        
        <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary);">
          Already have an account? <a href="#/login">Sign in</a>
        </p>
      </div>
    `;
    lucide.createIcons();
    this.initGoogleAuth();

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const data = await api.post('/auth/signup', { username, email, password });
        
        api.setToken(data.token);
        app.setUser(data.user);
        app.navigate('#/marketplace');
        ui.showToast('Account created successfully! Wallet funded with ₹1,000 for Demo.', 'success');
      } catch (err) {
        // Error handled in api.js
      }
    });
  },

  initGoogleAuth() {
    const container = document.getElementById('google-login-btn');
    if (container) {
      container.innerHTML = `<button class="btn btn-secondary btn-full" type="button" onclick="pages.auth.handleGoogleResponse({credential: 'mock_jwt'})" style="justify-content:center"><i data-lucide="chrome"></i> Continue with Google</button>`;
      lucide.createIcons();
    }
  },

  togglePassword(id) {
    const input = document.getElementById(id);
    const icon = document.getElementById(id + '-icon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  },

  async handleGoogleResponse(response) {
    try {
      const data = await api.post('/auth/google', { token: response.credential });
      api.setToken(data.token);
      app.setUser(data.user);
      app.navigate('#/marketplace');
      ui.showToast('Logged in automatically with Google', 'success');
    } catch (err) {}
  },

  async requestOtp() {
    const email = document.getElementById('email').value;
    if (!email) return ui.showToast('Please enter your email first', 'error');

    try {
      const res = await api.post('/auth/otp-request', { email });
      ui.showToast(`OTP Sent! Hint: ${res.hint}`, 'success');
      
      ui.openModal('Enter OTP', `
        <div class="form-group">
          <p style="margin-bottom: 1rem; color: var(--text-secondary);">Sent to ${email}</p>
          <input type="text" id="otp-input" class="form-control text-center" style="font-size: 1.5rem; letter-spacing: 0.5em;" placeholder="------" maxlength="6">
        </div>
        <button class="btn btn-primary btn-full" onclick="pages.auth.verifyOtp('${email}')">Verify & Login</button>
      `);
    } catch (err) {}
  },

  async verifyOtp(email) {
    const otp = document.getElementById('otp-input').value;
    try {
      const data = await api.post('/auth/otp-verify', { email, otp });
      ui.closeModal();
      api.setToken(data.token);
      app.setUser(data.user);
      app.navigate('#/marketplace');
      ui.showToast('Logged in successfully via OTP', 'success');
    } catch (err) {}
  }
};
