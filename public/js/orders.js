pages.orders = {
  activeTab: 'purchases',
  data: { asBuyer: [], asSeller: [] },

  async render() {
    document.getElementById('app').innerHTML = `
      <div class="fade-in" style="max-width: 1000px; margin: 0 auto;">
        <h1 class="title text-gradient">Orders & Escrow</h1>
        
        <div style="display:flex; border-bottom: 1px solid var(--border-light); margin-bottom: 2rem;">
          <button class="nav-tab ${this.activeTab==='purchases'?'active':''}" onclick="pages.orders.switchTab('purchases')">My Purchases</button>
          <button class="nav-tab ${this.activeTab==='sales'?'active':''}" onclick="pages.orders.switchTab('sales')">My Sales</button>
        </div>

        <div id="orders-list">
           <div class="spinner" style="margin:50px auto;"></div>
        </div>
      </div>
    `;

    // Add ad-hoc style for tabs
    if(!document.getElementById('orders-style')) {
      const s = document.createElement('style');
      s.id = 'orders-style';
      s.innerHTML = `
        .nav-tab { background:none; border:none; color:var(--text-secondary); font-size:1.1rem; padding: 1rem 2rem; cursor:pointer; font-family:var(--font-heading); position:relative; }
        .nav-tab:hover { color:white; }
        .nav-tab.active { color:var(--accent-cyan); font-weight:600; }
        .nav-tab.active::after { content:''; position:absolute; bottom:-1px; left:0; width:100%; height:2px; background:var(--accent-cyan); }
      `;
      document.head.appendChild(s);
    }

    this.loadData();
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.renderList();
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-tab[onclick*="${tab}"]`).classList.add('active');
  },

  async loadData() {
    try {
      this.data = await api.get('/orders');
      this.renderList();
    } catch (err) {}
  },

  renderList() {
    const list = this.activeTab === 'purchases' ? this.data.asBuyer : this.data.asSeller;
    const isBuyer = this.activeTab === 'purchases';
    const container = document.getElementById('orders-list');

    if (list.length === 0) {
      container.innerHTML = `<div class="glass-panel" style="text-align:center; color:var(--text-secondary);">No ${this.activeTab} found.</div>`;
      return;
    }

    container.innerHTML = list.map(o => {
      const statusMeta = this.getStatusMeta(o.status);
      return `
        <div class="glass-card" style="margin-bottom: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:1rem; margin-bottom:1rem;">
            <div style="font-family:monospace; color:var(--text-secondary);">ORD-${o.id.toString().padStart(6,'0')}</div>
            <span class="badge ${statusMeta.class}">${statusMeta.label.toUpperCase()}</span>
          </div>
          
          <div style="display:flex; gap:1.5rem; align-items:center;">
             <img src="${o.image_url}" style="width:100px; height:100px; object-fit:cover; border-radius:8px;" onerror="this.onerror=null; this.src='https://placehold.co/100x100/1f2937/22d3ee?text=Item'">
             <div style="flex:1;">
               <h3 style="font-size:1.2rem; margin-bottom:0.5rem;"><a href="#/listing/${o.listing_id}" style="color:white;">${o.title}</a></h3>
               <p style="color:var(--text-secondary); margin-bottom:0.5rem;">${isBuyer ? 'Seller' : 'Buyer'}: <b style="color:white;">${isBuyer ? o.seller_name : o.buyer_name}</b></p>
               <h4 style="color:var(--accent-cyan); font-family:var(--font-heading); font-size:1.2rem;">${ui.formatCurrency(o.amount)}</h4>
             </div>
             
             <!-- Actions Pane -->
             <div style="display:flex; flex-direction:column; gap:0.5rem; min-width:180px;">
               ${this.getActionButtons(o, isBuyer)}
             </div>
          </div>
          
          ${o.status === 'delivered' ? `
            <div style="margin-top:1.5rem; padding:1rem; background:rgba(0,0,0,0.2); border-radius:8px;">
               <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:0.5rem;"><b>Delivery Note from Seller:</b></p>
               <p style="white-space:pre-wrap; font-family:monospace;">${o.delivery_note || 'No note provided.'}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  getStatusMeta(status) {
    const map = {
      'pending': { label: 'Pending', class: 'badge-warning' },
      'escrow_held': { label: 'In Escrow (Awaiting Delivery)', class: 'badge-info' },
      'delivered': { label: 'Delivered (Awaiting Confirm)', class: 'badge-purple' },
      'confirmed': { label: 'Confirmed', class: 'badge-success' },
      'released': { label: 'Funds Released', class: 'badge-success' },
      'disputed': { label: 'Disputed', class: 'badge-error' },
      'refunded': { label: 'Refunded', class: 'badge-warning' },
      'cancelled': { label: 'Cancelled', class: 'badge-error' }
    };
    return map[status] || { label: status, class: 'badge-secondary' };
  },

  getActionButtons(order, isBuyer) {
    if (isBuyer) {
      if (order.status === 'escrow_held') return `<div style="text-align:right; color:var(--text-secondary); font-size:0.9rem;">Waiting for seller to deliver...</div>`;
      if (order.status === 'delivered') return `
        <button class="btn btn-primary" onclick="pages.orders.action('confirm', ${order.id})">Confirm Receipt</button>
        <button class="btn btn-danger" onclick="pages.orders.action('dispute', ${order.id})">Raise Dispute</button>
      `;
      if (order.status === 'disputed') return `<div style="text-align:right; color:var(--status-error); font-size:0.9rem;">Dispute under review</div>`;
    } else {
      // Seller actions
      if (order.status === 'escrow_held') return `
        <button class="btn btn-primary" onclick="pages.orders.action('deliver', ${order.id})">Mark as Delivered</button>
      `;
      if (order.status === 'delivered') return `<div style="text-align:right; color:var(--text-secondary); font-size:0.9rem;">Waiting for buyer confirmation...</div>`;
      if (order.status === 'disputed') return `<div style="text-align:right; color:var(--status-error); font-size:0.9rem;">Buyer raised a dispute. Admin will contact you.</div>`;
    }
    return '';
  },

  action(type, orderId) {
    if (type === 'confirm') {
      ui.openModal('Confirm Order Receipt', `
        <p>I confirm that I have received the item/service exactly as described.</p>
        <p style="color:var(--status-warning); margin:1rem 0;">This action will release the Escrow funds to the seller. It cannot be undone.</p>
        <button class="btn btn-primary btn-full" onclick="pages.orders.executeAction('${type}', ${orderId})">Release Funds</button>
      `);
    } else if (type === 'deliver') {
      ui.openModal('Deliver Order', `
        <div class="form-group">
          <label>Delivery/Completion Note for Buyer</label>
          <textarea id="delivery-note" class="form-control" rows="4" placeholder="e.g. Credits transferred to your username 'PlayerOne'. Transaction ID: #12345."></textarea>
        </div>
        <button class="btn btn-primary btn-full" onclick="pages.orders.executeAction('${type}', ${orderId})">Send Delivery Notification</button>
      `);
    } else if (type === 'dispute') {
      ui.openModal('Raise Dispute', `
        <div class="form-group">
          <label>Reason for dispute</label>
          <textarea id="dispute-reason" class="form-control" rows="4" placeholder="e.g. The seller never sent the item."></textarea>
        </div>
        <p style="color:var(--status-warning); margin-bottom:1rem; font-size:0.9rem;">Escrow funds will remain locked until an admin resolves this issue.</p>
        <button class="btn btn-danger btn-full" onclick="pages.orders.executeAction('${type}', ${orderId})">Submit Dispute</button>
      `);
    }
  },

  async executeAction(type, orderId) {
    let payload = {};
    if (type === 'deliver') payload.delivery_note = document.getElementById('delivery-note')?.value;
    if (type === 'dispute') {
      payload.reason = document.getElementById('dispute-reason')?.value;
      if(!payload.reason) return ui.showToast('Dispute reason required', 'error');
    }

    try {
      await api.post(`/orders/${orderId}/${type}`, payload);
      ui.closeModal();
      ui.showToast('Action successful', 'success');
      this.loadData();
    } catch(err) {}
  }
};
