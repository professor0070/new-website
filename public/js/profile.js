pages.profile = {
  myListings: [],

  async render() {
    const user = app.state.user;
    if (!user) return app.navigate('#/login');

    document.getElementById('app').innerHTML = `
      <div class="fade-in" style="max-width: 1200px; margin: 0 auto;">
        
        <!-- Seller Profile Header -->
        <div class="glass-panel" style="display:flex; gap:2rem; align-items:center; margin-bottom: 2rem; position:relative; overflow:hidden;">
          <div style="position:absolute; top:0; left:0; right:0; height:120px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(6, 182, 212, 0.4)); z-index:0;"></div>
          
          <div style="position:relative; z-index:1; margin-top:3rem;">
             <img src="${user.avatar_url}" class="avatar avatar-xl" style="border: 4px solid var(--bg-card); background: var(--bg-dark);" onerror="this.onerror=null; this.src='https://placehold.co/140x140/1f2937/a855f7?text=U'">
          </div>
          
          <div style="position:relative; z-index:1; margin-top:4rem; flex:1;">
             <h1 class="title text-gradient" style="font-size:2.5rem; margin-bottom:0.2rem;">${user.username}</h1>
             <p style="color:var(--text-secondary); margin-bottom:1rem;">Member since ${ui.formatDate(user.created_at || new Date())}</p>
             <button class="btn btn-secondary" onclick="pages.profile.showEditProfile()"><i data-lucide="settings" style="width:16px;"></i> Edit Profile</button>
          </div>
        </div>

        <!-- System Stats -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
           <div class="glass-card" style="text-align:center;">
              <h2 style="font-size:2.5rem; color:var(--accent-cyan); font-family:var(--font-heading);" id="p-listings">-</h2>
              <p style="color:var(--text-secondary); font-weight:500;">Active Listings</p>
           </div>
           <div class="glass-card" style="text-align:center;">
              <h2 style="font-size:2.5rem; color:var(--status-success); font-family:var(--font-heading);" id="p-sales">-</h2>
              <p style="color:var(--text-secondary); font-weight:500;">Successful Sales</p>
           </div>
           <div class="glass-card" style="text-align:center;">
              <h2 style="font-size:2.5rem; color:var(--accent-purple); font-family:var(--font-heading);" id="p-purchases">-</h2>
              <p style="color:var(--text-secondary); font-weight:500;">Items Purchased</p>
           </div>
        </div>

        <!-- Seller Revenue Analytics -->
        <div id="seller-revenue-section" style="margin-bottom: 2rem;">
          <div class="glass-card" style="text-align:center;"><div class="spinner" style="margin:30px auto;"></div></div>
        </div>

        <!-- Advanced Seller Dashboard -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 1.5rem;">
          <h2 class="title" style="font-size: 1.8rem;">Seller Dashboard</h2>
          <button class="btn btn-primary" onclick="pages.profile.showListingEditor()"><i data-lucide="plus"></i> Create Listing</button>
        </div>
        
        <div id="seller-listings-grid" class="grid-marketplace">
          <div class="glass-card"><div class="spinner" style="margin:40px auto;"></div></div>
        </div>

      </div>
    `;
    lucide.createIcons();
    this.loadStats();
    this.loadMyListings();
  },

  async loadStats() {
    try {
      const data = await api.get('/users/profile');
      document.getElementById('p-listings').innerText = data.stats.listings;
      document.getElementById('p-sales').innerText = data.stats.sales;
      document.getElementById('p-purchases').innerText = data.stats.purchases;

      // Render revenue metrics
      const revenueEl = document.getElementById('seller-revenue-section');
      if (!revenueEl) return;

      const maxRev = Math.max(...(data.weekly || []).map(d => d.revenue), 1);

      revenueEl.innerHTML = `
        <!-- Revenue Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1.5rem; margin-bottom:2.5rem;">
          <div class="glass-card" style="text-align:center; border-color:rgba(16,185,129,0.2);">
            <i data-lucide="trending-up" style="width:28px; color:var(--status-success); margin-bottom:0.5rem;"></i>
            <h2 style="font-size:2rem; color:var(--status-success); font-family:var(--font-heading);">₹${Number(data.stats.totalRevenue||0).toLocaleString()}</h2>
            <p style="color:var(--text-secondary);">Total Revenue Earned</p>
          </div>
          <div class="glass-card" style="text-align:center; border-color:rgba(245,158,11,0.2);">
            <i data-lucide="lock" style="width:28px; color:#f59e0b; margin-bottom:0.5rem;"></i>
            <h2 style="font-size:2rem; color:#f59e0b; font-family:var(--font-heading);">₹${Number(data.stats.pendingEscrow||0).toLocaleString()}</h2>
            <p style="color:var(--text-secondary);">In Escrow (Pending)</p>
          </div>
          <div class="glass-card" style="text-align:center;">
            <i data-lucide="bar-chart-2" style="width:28px; color:var(--accent-cyan); margin-bottom:0.5rem;"></i>
            <h2 style="font-size:2rem; color:var(--accent-cyan); font-family:var(--font-heading);">${data.stats.sales > 0 ? '₹'+Math.round(data.stats.totalRevenue/data.stats.sales).toLocaleString() : '—'}</h2>
            <p style="color:var(--text-secondary);">Avg. Sale Value</p>
          </div>
        </div>

        <!-- Weekly Revenue Bar Chart -->
        <div class="glass-panel" style="padding:2rem; margin-bottom:2rem;">
          <h3 style="margin-bottom:0.5rem;">Weekly Revenue Tracker</h3>
          <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:2rem;">Last 7 days of completed sales</p>
          ${data.weekly && data.weekly.length > 0
            ? `<div style="display:flex; align-items:flex-end; gap:0.75rem; height:160px;">
                ${data.weekly.map(d => {
                  const pct = Math.max(Math.round((d.revenue / maxRev) * 100), 4);
                  const day = new Date(d.day + 'T00:00:00').toLocaleDateString('en-US',{weekday:'short'});
                  return `
                    <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:0.5rem; height:100%;">
                      <span style="font-size:0.7rem; color:var(--text-secondary);">₹${Math.round(d.revenue).toLocaleString()}</span>
                      <div style="flex:1; width:100%; display:flex; align-items:flex-end;">
                        <div style="width:100%; height:${pct}%; background:linear-gradient(180deg,var(--accent-cyan),var(--accent-purple)); border-radius:8px 8px 0 0; transition:height 0.6s cubic-bezier(0.16,1,0.3,1); min-height:6px;"></div>
                      </div>
                      <span style="font-size:0.75rem; color:var(--text-secondary);">${day}</span>
                    </div>`;
                }).join('')}
              </div>`
            : `<div style="text-align:center; padding:2rem; color:var(--text-secondary);">
                 <i data-lucide="bar-chart-2" style="width:40px;height:40px;opacity:0.3;margin-bottom:1rem;"></i>
                 <p>No sales data yet for this period. Complete your first sale to unlock analytics!</p>
               </div>`
          }
        </div>
      `;
      lucide.createIcons({ root: revenueEl });
    } catch(err) {}
  },

  async loadMyListings() {
    try {
      const data = await api.get('/listings/my/all');
      this.myListings = data.listings;
      const grid = document.getElementById('seller-listings-grid');
      
      if (this.myListings.length === 0) {
        grid.innerHTML = \`<div style="grid-column: 1/-1; text-align:center; padding: 4rem; border: 1px dashed var(--border-light); border-radius: 20px; color: var(--text-secondary);">
          <i data-lucide="inbox" style="width:48px; height:48px; margin-bottom:1rem; opacity:0.5;"></i>
          <p>You have no active listings. Create your first product to start earning!</p>
        </div>\`;
        lucide.createIcons();
        return;
      }

      grid.innerHTML = this.myListings.map(l => \`
        <div class="glass-card" style="display:flex; flex-direction:column;">
          <img src="\${l.image_url}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 12px; margin-bottom: 1rem;" 
               onerror="this.onerror=null; this.src='https://placehold.co/300x180/1f2937/22d3ee?text=AvatarX'">
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
               <span class="badge badge-purple">\${l.category}</span>
               <span style="font-size:0.8rem; color:var(--status-success);"><i data-lucide="activity" style="width:12px; display:inline-block;"></i> Active</span>
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">\${l.title}</h3>
            <div class="product-price" style="font-size:1.2rem;">\${ui.formatCurrency(l.price, l.currency)}</div>
          </div>
          <div style="display:flex; gap: 0.5rem; margin-top: 1.5rem; border-top: 1px solid var(--border-light); padding-top: 1rem;">
             <button class="btn btn-secondary" style="flex:1; padding:0.5rem;" onclick="pages.profile.showListingEditor('\${l.id}')"><i data-lucide="edit-3"></i> Edit</button>
             <button class="btn btn-danger" style="flex:1; padding:0.5rem;" onclick="pages.profile.deleteListing('\${l.id}')"><i data-lucide="trash-2"></i> Delete</button>
          </div>
        </div>
      \`).join('');
      lucide.createIcons();
    } catch(err) {}
  },

  deleteListing(id) {
    api.confirm('Are you sure you want to permanently delete this listing? This action cannot be undone.', async () => {
      try {
        await api.delete(\`/listings/\${id}\`);
        ui.showToast('Listing deleted successfully', 'success');
        this.loadMyListings(); // Refresh grid instantly
        this.loadStats();
      } catch (err) {}
    });
  },

  showListingEditor(listingId = null) {
    const isEdit = !!listingId;
    const listing = isEdit ? this.myListings.find(l => l.id == listingId) : null;
    const user = app.state.user;

    // Advanced Dual-Pane Modal Layout
    ui.openModal(isEdit ? 'Edit Workflow' : 'Create New Item', \`
      <div style="display:flex; gap:2.5rem; flex-wrap: wrap;">
        
        <!-- Left: Form Controls & Upload -->
        <form id="editor-form" style="flex: 1; min-width: 300px; display:flex; flex-direction:column; gap:1.25rem;">
          
          <div id="drop-zone" style="border: 2px dashed var(--border-light); border-radius: 16px; padding: 2rem; text-align:center; cursor:pointer; transition:all 0.3s; background: rgba(0,0,0,0.2);">
             <i data-lucide="upload-cloud" style="width:48px; height:48px; color:var(--accent-cyan); margin-bottom:1rem;"></i>
             <p style="font-weight:500;">Drag & Drop Hero Image</p>
             <p style="color:var(--text-secondary); font-size:0.8rem; margin-top:0.5rem;">We support JPG, PNG, WEBP</p>
             <input type="file" id="le-file" accept="image/*" style="display:none;" />
          </div>

          <div class="form-group" style="margin:0;">
            <label>Title</label>
            <input type="text" id="le-title" class="form-control" required placeholder="e.g. 10k Credits Pack" value="\${listing?.title || ''}">
          </div>
          
          <div class="form-group" style="margin:0;">
            <label>Description</label>
            <textarea id="le-desc" class="form-control" rows="3" required>\${listing?.description || ''}</textarea>
          </div>
          
          <div style="display:flex; gap:1rem;">
            <div class="form-group" style="flex:1; margin:0;">
              <label>Price (INR)</label>
              <input type="number" id="le-price" class="form-control" required min="1" value="\${listing?.price || ''}">
            </div>
            <div class="form-group" style="flex:1; margin:0;">
              <label>Category</label>
              <select id="le-cat" class="form-control">
                <option value="credits" \${listing?.category === 'credits' ? 'selected' : ''}>Credits</option>
                <option value="vip" \${listing?.category === 'vip' ? 'selected' : ''}>VIP</option>
                <option value="couples" \${listing?.category === 'couples' ? 'selected' : ''}>Couples</option>
                <option value="skins" \${listing?.category === 'skins' ? 'selected' : ''}>Skins</option>
                <option value="outfits" \${listing?.category === 'outfits' ? 'selected' : ''}>Outfits</option>
              </select>
            </div>
          </div>
          
          <div class="form-group" style="margin:0;">
            <label>Delivery Method</label>
            <select id="le-del" class="form-control">
              <option value="manual" \${listing?.delivery_method === 'manual' ? 'selected' : ''}>Manual Trade</option>
              <option value="automatic" \${listing?.delivery_method === 'automatic' ? 'selected' : ''}>Automatic Delivery</option>
            </select>
          </div>
          
          <button type="submit" id="le-submit-btn" class="btn btn-primary btn-full" style="margin-top:1rem;">
             \${isEdit ? 'Save Changes' : 'Publish Listing'}
          </button>
        </form>

        <!-- Right: Live Preview Card -->
        <div style="flex: 1; min-width: 300px; padding: 1.5rem; background: var(--bg-dark); border-radius: 20px; border: 1px solid var(--border-light);">
           <p style="text-align:center; color:var(--text-secondary); font-size:0.85rem; margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.1em;">Live Customer Preview</p>
           
           <div class="glass-card" style="pointer-events:none; padding:1.5rem;">
             <img id="prev-img" src="\${listing?.image_url || 'https://placehold.co/300x180/1f2937/22d3ee?text=Preview'}" style="width:100%; height:180px; object-fit:cover; border-radius:12px; margin-bottom:1rem;">
             
             <div style="flex:1;">
               <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                  <span id="prev-cat" class="badge badge-purple" style="text-transform:capitalize;">\${listing?.category || 'credits'}</span>
               </div>
               <h3 id="prev-title" style="font-size: 1.1rem; margin-bottom: 0.5rem; word-break:break-word;">\${listing?.title || 'Listing Title'}</h3>
               <p id="prev-desc" style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break:break-word;">\${listing?.description || 'Your item description will appear here...'}</p>
             </div>
             
             <div style="border-top: 1px solid var(--border-light); padding-top: 1rem; display:flex; justify-content:space-between; align-items:center;">
               <div style="display:flex; align-items:center; gap: 8px;">
                  <img src="\${user.avatar_url}" class="avatar" style="width:24px; height:24px; border-width:1px;" onerror="this.onerror=null; this.src='https://placehold.co/24x24/1f2937/a855f7?text=U'">
                  <span style="font-size:0.9rem; color:var(--text-secondary);">\${user.username}</span>
               </div>
               <div id="prev-price" class="product-price">\${ui.formatCurrency(listing?.price || 0)}</div>
             </div>
           </div>
        </div>
      </div>
    \`);

    // Override max-width for this specific modal to fit dual panes
    document.querySelector('.modal-content').style.maxWidth = '1000px';

    // Set up Drag & Drop and Preview logic
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('le-file');
    let selectedFile = null;

    dropZone.addEventListener('click', () => fileInput.click());
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
      dropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); });
    });

    dropZone.addEventListener('dragover', () => dropZone.style.borderColor = 'var(--accent-purple)');
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--border-light)');
    
    const handleFile = (file) => {
      if (!file.type.startsWith('image/')) return ui.showToast('Must be an image type', 'error');
      selectedFile = file;
      dropZone.style.borderColor = 'var(--status-success)';
      dropZone.innerHTML = \`<i data-lucide="check-circle" style="width:48px; height:48px; color:var(--status-success); margin-bottom:1rem;"></i><p style="font-weight:500;">\${file.name}</p>\`;
      lucide.createIcons({ root: dropZone });
      document.getElementById('prev-img').src = URL.createObjectURL(file); // Instant Live File Preview
    };

    dropZone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    // Real-Time UI Binding listeners
    document.getElementById('le-title').addEventListener('input', (e) => document.getElementById('prev-title').innerText = e.target.value || 'Listing Title');
    document.getElementById('le-desc').addEventListener('input', (e) => document.getElementById('prev-desc').innerText = e.target.value || 'Item description...');
    document.getElementById('le-price').addEventListener('input', (e) => document.getElementById('prev-price').innerText = ui.formatCurrency(parseFloat(e.target.value) || 0));
    document.getElementById('le-cat').addEventListener('change', (e) => document.getElementById('prev-cat').innerText = e.target.value);

    // Form Submission (Multer FormData Upload)
    document.getElementById('editor-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('le-submit-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = \`<div class="spinner" style="width:20px;height:20px; border-width:2px; margin:0 auto;"></div>\`;
      btn.disabled = true;

      try {
        const formData = new FormData();
        formData.append('title', document.getElementById('le-title').value);
        formData.append('description', document.getElementById('le-desc').value);
        formData.append('price', document.getElementById('le-price').value);
        formData.append('category', document.getElementById('le-cat').value);
        formData.append('delivery_method', document.getElementById('le-del').value);
        if (selectedFile) {
          formData.append('image', selectedFile);
        } else if (!isEdit) {
          // If creation without image, backend handles fallback URL
        }

        if (isEdit) {
          await api.put(\`/listings/\${listingId}\`, formData);
          ui.showToast('Listing updated successfully!', 'success');
        } else {
          await api.post('/listings', formData);
          ui.showToast('Listing published globally!', 'success');
        }
        
        // Reset modal widths and refresh
        document.querySelector('.modal-content').style.maxWidth = '480px';
        ui.closeModal();
        this.loadStats();
        this.loadMyListings();
        
        // Also refresh marketplace if it was loaded in memory
        if (pages.marketplace.currentFilter) pages.marketplace.loadListings();
      } catch (err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  },

  showEditProfile() {
    const user = app.state.user;
    ui.openModal('Edit Profile', \`
      <form id="edit-profile-form">
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="ep-username" class="form-control" value="\${user.username}">
        </div>
        <div class="form-group">
          <label>Bio</label>
          <textarea id="ep-bio" class="form-control" rows="3">\${user.bio || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Avatar URL</label>
          <input type="url" id="ep-avatar" class="form-control" value="\${user.avatar_url}" placeholder="https://example.com/avatar.png">
        </div>
        <button type="submit" class="btn btn-primary btn-full">Save Changes</button>
      </form>
    \`);
    
    // reset to normal width
    document.querySelector('.modal-content').style.maxWidth = '480px';

    document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api.put('/users/profile', {
          username: document.getElementById('ep-username').value,
          bio: document.getElementById('ep-bio').value,
          avatar_url: document.getElementById('ep-avatar').value
        });
        app.setUser(res.user);
        ui.closeModal();
        ui.showToast('Profile updated', 'success');
        this.render();
      } catch(err) {}
    });
  }
};
