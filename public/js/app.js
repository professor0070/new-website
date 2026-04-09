/**
 * Main SPA Router and State Manager
 */

const app = {
  state: {
    user: null,
    currentProfile: null,
    currentListing: null,
    seenNotifIds: new Set()
  },
  notifPollInterval: null,
  
  routes: {
    '#/': () => window.location.hash = '#/marketplace',
    '#/marketplace': () => pages.marketplace.render(),
    '#/login': () => pages.auth.renderLogin(),
    '#/admin-login': () => pages.auth.renderAdminLogin(),
    '#/signup': () => pages.auth.renderSignup(),
    '#/profile': () => app.state.user ? pages.profile.render() : window.location.hash = '#/login',
    '#/wallet': () => app.state.user ? pages.wallet.render() : window.location.hash = '#/login',
    '#/orders': () => app.state.user ? pages.orders.render() : window.location.hash = '#/login',
    '#/admin': () => app.state.user?.role === 'admin' ? pages.admin.render() : window.location.hash = '#/',
  },

  setUser(user) {
    this.state.user = user;
    this.renderNav();
  },

  async init() {
    // Attempt to load user from token
    if (api.getToken()) {
      try {
        const data = await api.get('/auth/me');
        this.setUser(data.user);
      } catch (err) {
        this.setUser(null);
      }
    } else {
      this.setUser(null);
    }

    // Handle routing
    window.addEventListener('hashchange', () => this.handleRoute());
    if (!window.location.hash) window.location.hash = '#/marketplace';
    else this.handleRoute();

    // Start notification polling for logged-in users
    if (this.state.user) this.startNotifPolling();
  },

  startNotifPolling() {
    if (this.notifPollInterval) clearInterval(this.notifPollInterval);
    this.checkNotifications();
    this.notifPollInterval = setInterval(() => this.checkNotifications(), 15000);
  },

  async checkNotifications() {
    if (!this.state.user) return;
    try {
      const data = await api.get('/notifications/my');
      const unread = data.notifications.filter(n => !n.is_read && !this.state.seenNotifIds.has(n.id));
      
      // Update bell badge
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = unread.length > 0 ? 'flex' : 'none';
      if (badge) badge.innerText = unread.length > 9 ? '9+' : unread.length;

      // Show toasts for new ones
      unread.forEach(n => {
        if (!this.state.seenNotifIds.has(n.id)) {
          this.state.seenNotifIds.add(n.id);
          ui.showToast(`📢 ${n.title}: ${n.message}`, n.type || 'info');
        }
      });
    } catch(err) {}
  },

  handleRoute() {
    const hash = window.location.hash;
    const rootPath = hash.split('/')[1] ? `#/${hash.split('/')[1]}` : '#/';

    document.getElementById('app').innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; height: 50vh;">
        <div class="spinner" style="width: 48px; height: 48px;"></div>
      </div>
    `;

    // Dynamic routing for Listing params like #/listing/1
    if (hash.startsWith('#/listing/')) {
      const id = hash.split('/')[2];
      pages.listing.render(id);
      return;
    }

    if (this.routes[hash]) {
      this.routes[hash]();
    } else if (this.routes[rootPath]) {
      this.routes[rootPath]();
    } else {
      document.getElementById('app').innerHTML = `<h2>404 - Page Not Found</h2>`;
    }
  },

  navigate(hash) {
    window.location.hash = hash;
  },

  renderNav() {
    const nav = document.getElementById('nav-links');
    const { user } = this.state;
    
    const currentHash = window.location.hash;
    const isActive = (path) => currentHash.startsWith(path) ? 'active' : '';

    if (user) {
      nav.innerHTML = `
        <a href="#/marketplace" class="${isActive('#/marketplace')}">Marketplace</a>
        <a href="#/orders" class="${isActive('#/orders')}">Orders</a>
        <a href="#/wallet" class="${isActive('#/wallet')}">
          <i data-lucide="wallet" style="width:16px; display:inline-block; vertical-align:middle;"></i> Wallet
        </a>
        
        <div style="display:flex; align-items:center; gap: 10px; margin-left: 1rem;">
          <!-- Notification Bell -->
          <div style="position:relative; cursor:pointer;" onclick="app.openNotifications()" title="Notifications">
            <button class="btn btn-secondary" style="padding: 0.5rem 0.75rem; position:relative;" id="bell-btn">
              <i data-lucide="bell" style="width:18px; height:18px;"></i>
            </button>
            <span id="notif-badge" style="display:none; position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border-radius:50%; width:18px; height:18px; font-size:0.65rem; font-weight:700; align-items:center; justify-content:center; border:2px solid var(--bg-dark);">0</span>
          </div>
          ${user.role === 'admin' ? `<a href="#/admin" class="btn btn-secondary" style="padding:0.5rem 0.75rem; background:rgba(239,68,68,0.15); border-color:rgba(239,68,68,0.3); color:#f87171;"><i data-lucide="shield" style="width:16px;"></i></a>` : ''}
          <a href="#/profile">
            <img src="${user.avatar_url}" class="avatar" alt="Avatar">
          </a>
          <button class="btn btn-secondary" onclick="app.logout()" style="padding: 0.5rem 1rem;">Logout</button>
        </div>
      `;
    } else {
      nav.innerHTML = `
        <a href="#/marketplace" class="${isActive('#/marketplace')}">Explore</a>
        <a href="#/login">Login</a>
        <a href="#/signup" class="btn btn-primary">Sign Up</a>
      `;
    }
    lucide.createIcons({ root: nav });
  },

  logout() {
    if (this.notifPollInterval) clearInterval(this.notifPollInterval);
    this.notifPollInterval = null;
    this.state.seenNotifIds = new Set();
    api.setToken(null);
    this.setUser(null);
    this.navigate('#/login');
    ui.showToast('Logged out successfully', 'success');
  },

  async openNotifications() {
    try {
      const data = await api.get('/notifications/my');
      const notifs = data.notifications;

      // Mark badge as seen
      this.state.seenNotifIds = new Set(notifs.map(n => n.id));
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = 'none';

      ui.openModal('Notifications', notifs.length === 0
        ? `<div style="text-align:center; padding:2rem; color:var(--text-secondary);">
             <i data-lucide="bell-off" style="width:40px; height:40px; margin-bottom:1rem;"></i>
             <p>No notifications yet.</p>
           </div>`
        : notifs.map(n => `
            <div style="display:flex; gap:0.75rem; margin-bottom:1rem; padding:1rem; background:rgba(0,0,0,0.2); border-radius:12px; border-left:3px solid ${n.type === 'error' ? '#f87171' : n.type === 'success' ? 'var(--status-success)' : n.type === 'warning' ? '#f59e0b' : 'var(--accent-cyan)'};">
              <div style="flex:1;">
                <p style="font-weight:600;">${n.title}</p>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin:0.25rem 0;">${n.message}</p>
                <p style="color:var(--text-secondary); font-size:0.75rem;">${ui.formatDate(n.created_at)}</p>
              </div>
            </div>`).join('')
      );
    } catch(err) {}
  }
};

// Global pages namespace
const pages = {};

// Init on load
window.addEventListener('DOMContentLoaded', () => app.init());
