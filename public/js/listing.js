pages.listing = {
  async render(id) {
    if (!id) return app.navigate('#/marketplace');

    document.getElementById('app').innerHTML = `
      <div id="listing-container" class="fade-in">
        <div class="spinner" style="margin:100px auto;"></div>
      </div>
    `;

    try {
      const { listing } = await api.get(`/listings/${id}`);
      app.state.currentListing = listing;

      const isOwner = app.state.user && app.state.user.id === listing.seller_id;
      const isLoggedIn = !!app.state.user;

      document.getElementById('listing-container').innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 350px; gap: 2rem;">
          <!-- Left Column: Details -->
          <div>
            <div class="glass-panel" style="margin-bottom: 2rem; padding:0; overflow:hidden;">
              <img src="${listing.image_url}" style="width:100%; height:400px; object-fit:cover;" onerror="this.onerror=null; this.src='https://placehold.co/800x400/1f2937/22d3ee?text=AvatarX'">
            </div>
            
            <div class="glass-panel">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                <h1 style="font-size:2rem; margin:0;" class="text-gradient">${listing.title}</h1>
                <h2 style="font-family:var(--font-heading); color:var(--accent-cyan); margin:0; font-size: 2rem;">${ui.formatCurrency(listing.price, listing.currency)}</h2>
              </div>
              
              <div style="display:flex; gap: 1rem; margin-bottom: 1.5rem;">
                 <span class="badge badge-purple">${listing.category.toUpperCase()}</span>
                 <span class="badge badge-info"><i data-lucide="shield-check" style="width:12px; height:12px; margin-right:4px; vertical-align:middle;"></i> Escrow Protected</span>
              </div>
              
              <h3 style="margin-bottom:0.8rem; color:var(--text-secondary);">Description</h3>
              <p style="white-space:pre-wrap; line-height:1.7;">${listing.description}</p>
            </div>
          </div>

          <!-- Right Column: Action & Seller Info -->
          <div>
            <div class="glass-panel" style="margin-bottom: 1.5rem; position:sticky; top: 100px;">
              ${isOwner 
                ? `<div style="text-align:center; padding: 1rem; color: var(--text-secondary);">This is your listing.</div>`
                : `<button class="btn btn-primary btn-full" style="font-size:1.1rem; padding: 1rem;" onclick="pages.listing.buyIntent()">Buy Now</button>
                   <p style="text-align:center; font-size:0.8rem; color:var(--text-secondary); margin-top:1rem;">
                     Funds are held in <a href="javascript:void(0)" onclick="pages.listing.showEscrowInfo()" style="text-decoration:underline;">Escrow</a> until you confirm delivery.
                   </p>`
              }
            </div>

            <div class="glass-panel">
              <h3 style="margin-bottom:1.5rem; font-size:1.1rem;">About the Seller</h3>
              <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem;">
                <img src="${listing.seller_avatar}" class="avatar avatar-lg" onerror="this.onerror=null; this.src='https://placehold.co/80x80/1f2937/a855f7?text=U'">
                <div>
                  <h4 style="font-size:1.2rem; margin:0;">${listing.seller_name}</h4>
                  <p style="color:var(--status-success); font-size:0.9rem; margin-top:0.3rem;"><i data-lucide="check-circle" style="width:14px; height:14px; vertical-align:middle;"></i> ${listing.seller_sales} Successful Sales</p>
                </div>
              </div>
              </div>
              ${listing.seller_bio ? `<p style="color:var(--text-secondary); font-size:0.9rem;">${listing.seller_bio}</p>` : ''}
              
              <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light);">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                   <span style="color:var(--text-secondary);">Delivery Method</span>
                   <span style="font-weight:600; text-transform:capitalize;">${listing.delivery_method}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                   <span style="color:var(--text-secondary);">Member Since</span>
                   <span style="font-weight:600;">${ui.formatDate(listing.seller_since)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
      
      // Responsive layout adjustments
      const style = document.createElement('style');
      style.innerHTML = `@media(max-width: 900px) { #listing-container > div { grid-template-columns: 1fr !important; } }`;
      document.head.appendChild(style);

    } catch (err) {
      document.getElementById('app').innerHTML = `<h2 style="text-align:center; margin-top: 4rem;">Listing not found</h2>`;
    }
  },

  showEscrowInfo() {
    ui.openModal('How Escrow Works', `
      <p style="color:var(--text-secondary); margin-bottom: 1.5rem;">AvatarX uses Escrow to ensure 100% safe transactions for both buyers and sellers.</p>
      <ol style="padding-left: 1.2rem; line-height:1.8;">
        <li><b>You pay:</b> The money is deducted from your wallet but safely held by AvatarX.</li>
        <li><b>Seller delivers:</b> The seller provides the item (sends credits, invites to VIP, etc.) and marks the order as Delivered.</li>
        <li><b>You confirm:</b> Once you receive the item, you confirm the order. Only then is the money released to the seller!</li>
        <li><b>Disputes:</b> If there's an issue, you can raise a dispute and an Admin will intervene.</li>
      </ol>
      <button class="btn btn-primary btn-full" style="margin-top: 1.5rem;" onclick="ui.closeModal()">Got it</button>
    `);
  },

  async buyIntent() {
    if (!app.state.user) return app.navigate('#/login');
    const listing = app.state.currentListing;

    // Check balance
    try {
      const { wallet } = await api.get('/wallet');
      if (wallet.balance < listing.price) {
        ui.openModal('Insufficient Balance', `
          <div style="text-align:center; padding: 1rem 0;">
            <i data-lucide="wallet" style="width:48px; height:48px; color:var(--accent-pink); margin-bottom:1rem;"></i>
            <p style="margin-bottom:1.5rem;">Need <b>${ui.formatCurrency(listing.price - wallet.balance)}</b> more to buy this.</p>
            <button class="btn btn-primary btn-full" onclick="ui.closeModal(); app.navigate('#/wallet')">Add Funds to Wallet</button>
          </div>
        `);
      } else {
        ui.openModal('Confirm Purchase', `
          <div style="background:rgba(0,0,0,0.3); padding:1rem; border-radius:8px; margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <span>Item:</span> <b>${listing.title}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <span>Seller:</span> <b>${listing.seller_name}</b>
            </div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--border-light); padding-top:0.5rem; margin-top:0.5rem;">
              <span>Total:</span> <b style="color:var(--accent-cyan); font-size:1.2rem;">${ui.formatCurrency(listing.price)}</b>
            </div>
          </div>
          <p style="font-size:0.9rem; color:var(--text-secondary); text-align:center; margin-bottom:1.5rem;">
            Funds will be held in Escrow until you confirm delivery.
          </p>
          <div style="display:flex; gap:1rem;">
            <button class="btn btn-secondary" style="flex:1;" onclick="ui.closeModal()">Cancel</button>
            <button class="btn btn-primary" style="flex:1;" onclick="pages.listing.placeOrder()">Pay Securely</button>
          </div>
        `);
      }
      lucide.createIcons();
    } catch (err) {}
  },

  async placeOrder() {
    const listing = app.state.currentListing;
    try {
      await api.post('/orders', { listing_id: listing.id });
      ui.closeModal();
      ui.showToast('Order placed successfully! Check your Orders.', 'success');
      setTimeout(() => app.navigate('#/orders'), 1000);
    } catch (err) {}
  }
};
