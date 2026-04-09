pages.marketplace = {
  currentFilter: 'all',
  
  async render() {
    document.getElementById('app').innerHTML = `
      <div class="fade-in">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 2rem;">
          <div>
            <h1 class="title text-gradient" style="margin-bottom: 0.5rem;">Explore Marketplace</h1>
            <p class="subtitle">Discover premium virtual goods, credits, and VIP packages from trusted sellers.</p>
          </div>
          ${app.state.user ? `<button class="btn btn-primary" onclick="pages.marketplace.showCreateListing()"><i data-lucide="plus"></i> Create Listing</button>` : ''}
        </div>
        
        <div style="display:flex; gap: 1rem; margin-bottom: 2rem; overflow-x: auto; padding-bottom: 0.5rem;">
          <button class="btn ${this.currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="pages.marketplace.filter('all')">All</button>
          <button class="btn ${this.currentFilter === 'credits' ? 'btn-primary' : 'btn-secondary'}" onclick="pages.marketplace.filter('credits')">Credits</button>
          <button class="btn ${this.currentFilter === 'vip' ? 'btn-primary' : 'btn-secondary'}" onclick="pages.marketplace.filter('vip')">VIP Access</button>
          <button class="btn ${this.currentFilter === 'couples' ? 'btn-primary' : 'btn-secondary'}" onclick="pages.marketplace.filter('couples')">Couples</button>
          <button class="btn ${this.currentFilter === 'skins' ? 'btn-primary' : 'btn-secondary'}" onclick="pages.marketplace.filter('skins')">Skins</button>
          <button class="btn ${this.currentFilter === 'outfits' ? 'btn-primary' : 'btn-secondary'}" onclick="pages.marketplace.filter('outfits')">Outfits</button>
        </div>

        <div id="marketplace-grid" class="grid-marketplace">
          <!-- Load skeleton -->
          <div class="glass-card"><div class="spinner" style="margin:40px auto;"></div></div>
        </div>
      </div>
    `;
    lucide.createIcons();
    this.loadListings();
  },

  async filter(category) {
    this.currentFilter = category;
    this.render();
  },

  async loadListings() {
    try {
      const qs = this.currentFilter !== 'all' ? `?category=${this.currentFilter}` : '';
      const data = await api.get(`/listings${qs}`);
      const grid = document.getElementById('marketplace-grid');
      
      if (data.listings.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-secondary);">No items found in this category.</div>`;
        return;
      }

      grid.innerHTML = data.listings.map(l => `
        <a href="#/listing/${l.id}" class="glass-card" style="display:flex; flex-direction:column; color:inherit;">
          <img src="${l.image_url}" class="product-image" onerror="this.onerror=null; this.src='https://placehold.co/300x180/1f2937/22d3ee?text=AvatarX'">
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
               <span class="badge badge-purple">${l.category}</span>
               <span style="font-size:0.8rem; color:var(--text-secondary);"><i data-lucide="${l.delivery_method === 'automatic' ? 'zap' : 'clock'}" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> ${l.delivery_method}</span>
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${l.title}</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${l.description}</p>
          </div>
          <div class="product-meta" style="border-top: 1px solid var(--border-light); padding-top: 1rem;">
            <div style="display:flex; align-items:center; gap: 8px;">
               <img src="${l.seller_avatar}" class="avatar" style="width:24px; height:24px; border-width:1px;" onerror="this.onerror=null; this.src='https://placehold.co/24x24/1f2937/a855f7?text=U'">
               <span style="font-size:0.9rem; color:var(--text-secondary);">${l.seller_name}</span>
            </div>
            <div class="product-price">${ui.formatCurrency(l.price, l.currency)}</div>
          </div>
        </a>
      `).join('');
      lucide.createIcons();
    } catch (err) {
      document.getElementById('marketplace-grid').innerHTML = `<div style="grid-column: 1/-1; text-align:center; color: var(--status-error);">Failed to load marketplace items.</div>`;
    }
  },

  showCreateListing() {
    if (pages.profile && typeof pages.profile.showListingEditor === 'function') {
      pages.profile.showListingEditor();
    } else {
      // profile page not loaded yet — navigate there and it will show the editor
      app.navigate('#/profile');
    }
  }
};
