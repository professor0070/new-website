/**
 * API Client Configuration
 */
const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('token');
  },
  
  setToken(token) {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...options.headers };

    // If body is NOT FormData, default to application/json
    const isFormData = options.body instanceof FormData;
    if (!isFormData && !headers['Content-Type'] && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Auto logout on token expiry
          this.setToken(null);
          app.setUser(null);
          app.navigate('#/login');
        }
        throw new Error(data.error || 'API Request Failed');
      }

      return data;
    } catch (err) {
      ui.showToast(err.message, 'error');
      throw err;
    }
  },

  get(endpoint) { return this.request(endpoint); },
  post(endpoint, data) { 
    return this.request(endpoint, { 
      method: 'POST', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }); 
  },
  put(endpoint, data) { 
    return this.request(endpoint, { 
      method: 'PUT', 
      body: data instanceof FormData ? data : JSON.stringify(data) 
    }); 
  },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

/**
 * UI Utilities
 */
const ui = {
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div style="display:flex; align-items:center; gap: 8px;">
                         ${type === 'error' ? '<i data-lucide="alert-circle"></i>' : '<i data-lucide="check-circle"></i>'}
                         <span>${message}</span>
                       </div>`;
    container.appendChild(toast);
    lucide.createIcons({ root: toast });
    
    setTimeout(() => {
      toast.remove();
    }, 3500);
  },

  openModal(title, contentHtml) {
    const modal = document.getElementById('global-modal');
    const content = document.getElementById('modal-content-area');
    
    content.innerHTML = `
      <div class="modal-header">
        <h3 style="font-family: var(--font-heading); color: var(--accent-cyan);">${title}</h3>
        <button class="modal-close" onclick="ui.closeModal()"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        ${contentHtml}
      </div>
    `;
    
    lucide.createIcons({ root: content });
    modal.classList.add('active');
  },

  closeModal() {
    document.getElementById('global-modal').classList.remove('active');
  },
  
  confirm(message, onConfirm) {
    this.openModal('Confirm Action', `
      <p style="margin-bottom:2rem; color:var(--text-secondary); font-size:1.1rem;">${message}</p>
      <div style="display:flex; gap:1rem;">
        <button class="btn btn-secondary" style="flex:1;" onclick="ui.closeModal()">Cancel</button>
        <button class="btn btn-danger" style="flex:1;" id="confirm-btn">Confirm Proceed</button>
      </div>
    `);
    document.getElementById('confirm-btn').addEventListener('click', () => {
      ui.closeModal();
      onConfirm();
    });
  },
  
  formatCurrency(amount, currency = 'INR') {
    if (currency === 'CREDITS') {
      return `${amount.toLocaleString()} 💎`;
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  },
  
  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};
