pages.admin = {
  async render() {
    if (!app.state.user || app.state.user.role !== 'admin') return app.navigate('#/');

    document.getElementById('app').innerHTML = `
      <div class="fade-in" style="max-width:1400px; margin:0 auto;">

        <!-- Super Admin Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:2.5rem; flex-wrap:wrap; gap:1rem;">
          <div>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.4rem;">
              <div style="padding:0.5rem; background:rgba(239,68,68,0.15); border-radius:10px; border:1px solid rgba(239,68,68,0.3);">
                <i data-lucide="shield-check" style="width:22px; height:22px; color:#f87171;"></i>
              </div>
              <span style="color:#f87171; font-size:0.8rem; font-weight:600; text-transform:uppercase; letter-spacing:0.12em;">Super Admin</span>
            </div>
            <h1 class="title" style="font-size:2.2rem; margin:0;">Command Center</h1>
            <p class="subtitle" style="margin:0.3rem 0 0;">Real-time platform monitoring & control</p>
          </div>
          <div id="last-refresh" style="color:var(--text-secondary); font-size:0.8rem;"></div>
        </div>

        <!-- Live Metric Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:1.5rem; margin-bottom:2.5rem;" id="admin-stats-grid">
          <div class="glass-card" style="text-align:center;">
            <div class="spinner" style="margin:20px auto;"></div>
          </div>
        </div>

        <!-- Two-Column Layout: Broadcasts + Disputes -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-bottom:2rem;">

          <!-- Broadcast Panel -->
          <div class="glass-panel" style="padding:2rem;">
            <h3 style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem; color:#f87171;">
              <i data-lucide="megaphone" style="width:20px;"></i> Broadcast Notification
            </h3>
            <form id="broadcast-form">
              <div class="form-group">
                <label>Notification Title</label>
                <input type="text" id="notif-title" class="form-control" placeholder="e.g. Platform Maintenance Notice" required>
              </div>
              <div class="form-group">
                <label>Message</label>
                <textarea id="notif-msg" class="form-control" rows="3" placeholder="Type your global message..." required></textarea>
              </div>
              <div class="form-group">
                <label>Type</label>
                <select id="notif-type" class="form-control">
                  <option value="info">ℹ️ Info</option>
                  <option value="success">✅ Success / Announcement</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="error">🔴 Critical Alert</option>
                </select>
              </div>
              <button type="submit" id="broadcast-btn" class="btn btn-full" style="background:rgba(239,68,68,0.2); color:#fecaca; border:1px solid rgba(239,68,68,0.4);">
                <i data-lucide="send"></i> Broadcast to All Users
              </button>
            </form>

            <!-- Broadcast History -->
            <div style="margin-top:2rem;">
              <h4 style="color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem;">Recent Broadcasts</h4>
              <div id="notif-history"><div class="spinner" style="margin:0 auto;"></div></div>
            </div>
          </div>

          <!-- Disputes Panel -->
          <div class="glass-panel" style="padding:2rem;">
            <h3 style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem; color:var(--accent-cyan);">
              <i data-lucide="gavel" style="width:20px;"></i> Open Disputes
            </h3>
            <div id="admin-disputes"><div class="spinner" style="margin:0 auto;"></div></div>
          </div>
        </div>

        <!-- Users Table -->
        <div class="glass-panel" style="padding:2rem;">
          <h3 style="margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem;">
            <i data-lucide="users" style="width:20px; color:var(--accent-purple);"></i> User Management
          </h3>
          <div id="admin-users"><div class="spinner" style="margin:0 auto;"></div></div>
        </div>

      </div>
    `;
    lucide.createIcons();
    this.loadStats();
    this.loadDisputes();
    this.loadUsers();
    this.loadNotifHistory();
    this.setupBroadcastForm();
  },

  async loadStats() {
    try {
      const data = await api.get('/admin/stats');
      document.getElementById('last-refresh').innerHTML = `<i data-lucide="refresh-cw" style="width:12px; display:inline-block; vertical-align:middle;"></i> Live · ${new Date().toLocaleTimeString()}`;
      document.getElementById('admin-stats-grid').innerHTML = `
        ${this.statCard('Total Users', data.usersCount, 'users', 'var(--accent-purple)')}
        ${this.statCard('Active Listings', data.listingsCount, 'package', 'var(--accent-cyan)')}
        ${this.statCard('Total Orders', data.ordersCount, 'shopping-bag', 'var(--status-success)')}
        ${this.statCard('Escrow Held', '₹' + Number(data.escrowTotal).toLocaleString(), 'lock', '#f59e0b')}
      `;
      lucide.createIcons();
    } catch(err) {}
  },

  statCard(label, value, icon, color) {
    return `
      <div class="glass-card" style="text-align:center; position:relative; overflow:hidden;">
        <div style="position:absolute; top:-20px; right:-20px; width:80px; height:80px; background:${color}; opacity:0.06; border-radius:50%;"></div>
        <i data-lucide="${icon}" style="width:28px; height:28px; color:${color}; margin-bottom:0.75rem;"></i>
        <h2 style="font-size:2.2rem; font-family:var(--font-heading); color:${color}; margin-bottom:0.3rem;">${value}</h2>
        <p style="color:var(--text-secondary); font-size:0.9rem;">${label}</p>
      </div>
    `;
  },

  async loadDisputes() {
    try {
      const data = await api.get('/admin/disputes');
      const el = document.getElementById('admin-disputes');
      const open = data.disputes.filter(d => d.status === 'open');

      if (open.length === 0) {
        el.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--status-success);">
          <i data-lucide="check-circle" style="width:40px; height:40px; margin-bottom:1rem;"></i>
          <p>No open disputes. Platform running smoothly!</p>
        </div>`;
        lucide.createIcons({ root: el });
        return;
      }

      el.innerHTML = open.map(d => `
        <div style="padding:1.25rem; background:rgba(0,0,0,0.2); border-radius:12px; margin-bottom:1rem; border:1px solid rgba(239,68,68,0.2);">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
            <span style="font-weight:600;">${d.listing_title}</span>
            <span class="badge" style="background:rgba(239,68,68,0.15); color:#f87171;">OPEN</span>
          </div>
          <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.75rem;">${d.buyer_name} vs ${d.seller_name} · ₹${d.amount}</p>
          <p style="font-size:0.85rem; margin-bottom:1rem; color:var(--text-primary);">${d.reason}</p>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary" style="flex:1; padding:0.5rem; font-size:0.8rem;" onclick="pages.admin.resolveDispute(${d.id},'refund_buyer')">Refund Buyer</button>
            <button class="btn btn-primary" style="flex:1; padding:0.5rem; font-size:0.8rem;" onclick="pages.admin.resolveDispute(${d.id},'release_seller')">Release to Seller</button>
          </div>
        </div>
      `).join('');
      lucide.createIcons({ root: el });
    } catch(err) {}
  },

  async resolveDispute(id, resolution) {
    ui.confirm(`Confirm: ${resolution === 'refund_buyer' ? 'Refund buyer and penalise seller?' : 'Release escrow funds to seller?'}`, async () => {
      try {
        await api.post(`/admin/disputes/${id}/resolve`, { resolution, admin_notes: 'Resolved by admin' });
        ui.showToast('Dispute resolved successfully', 'success');
        this.loadDisputes();
        this.loadStats();
      } catch(err) {}
    });
  },

  async loadUsers() {
    try {
      // Use admin stats + /auth/me workaround; for a full user list we use listings query cross-ref
      const data = await api.get('/admin/stats');
      document.getElementById('admin-users').innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--text-secondary);">
          <p><b style="color:var(--text-primary); font-size:1.5rem;">${data.usersCount}</b> registered users on the platform.</p>
          <p style="font-size:0.85rem; margin-top:0.5rem;">Manage individual users through dispute resolution. Full User Management API in progress.</p>
        </div>
      `;
    } catch(err) {}
  },

  async loadNotifHistory() {
    try {
      const data = await api.get('/notifications/my');
      const el = document.getElementById('notif-history');
      const broadcasts = data.notifications.filter(n => !n.user_id).slice(0, 5);

      if (broadcasts.length === 0) {
        el.innerHTML = `<p style="color:var(--text-secondary); font-size:0.85rem;">No broadcasts yet.</p>`;
        return;
      }

      el.innerHTML = broadcasts.map(n => `
        <div style="display:flex; gap:0.75rem; align-items:flex-start; margin-bottom:1rem; padding:1rem; background:rgba(0,0,0,0.2); border-radius:10px; border-left:3px solid ${n.type === 'error' ? '#f87171' : n.type === 'success' ? 'var(--status-success)' : n.type === 'warning' ? '#f59e0b' : 'var(--accent-cyan)'};">
          <div style="flex:1;">
            <p style="font-weight:600; font-size:0.9rem;">${n.title}</p>
            <p style="color:var(--text-secondary); font-size:0.8rem; margin:0.2rem 0;">${n.message}</p>
            <p style="color:var(--text-secondary); font-size:0.75rem;">${ui.formatDate(n.created_at)}</p>
          </div>
        </div>
      `).join('');
    } catch(err) {}
  },

  setupBroadcastForm() {
    document.getElementById('broadcast-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('broadcast-btn');
      const original = btn.innerHTML;
      btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto;"></div>`;
      btn.disabled = true;

      try {
        await api.post('/admin/notify', {
          title: document.getElementById('notif-title').value,
          message: document.getElementById('notif-msg').value,
          type: document.getElementById('notif-type').value
        });
        ui.showToast('Broadcast sent to all users!', 'success');
        document.getElementById('broadcast-form').reset();
        this.loadNotifHistory();
      } catch(err) {} finally {
        btn.innerHTML = original;
        btn.disabled = false;
      }
    });
  }
};
