pages.wallet = {
  async render() {
    document.getElementById('app').innerHTML = `
      <div class="fade-in" style="max-width: 1000px; margin: 0 auto;">
        <h1 class="title text-gradient">My Wallet</h1>
        
        <div id="wallet-dashboard">
          <div class="spinner" style="margin:50px auto;"></div>
        </div>

        <div class="glass-panel" style="margin-top: 2rem;">
          <h3 style="margin-bottom: 1.5rem;">Transaction History</h3>
          <div id="wallet-transactions"></div>
        </div>
      </div>
    `;
    
    this.loadData();
  },

  async loadData() {
    try {
      const [walletData, txData] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions')
      ]);

      const w = walletData.wallet;
      
      document.getElementById('wallet-dashboard').innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
          
          <div class="glass-card" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.1)); border-color: var(--accent-purple);">
            <p style="color:rgba(255,255,255,0.8); margin-bottom:0.5rem; text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;">Available Balance</p>
            <h2 style="font-size:3rem; margin:0; line-height:1; font-family:var(--font-heading); color:white;">${ui.formatCurrency(w.balance)}</h2>
            <div style="display:flex; gap:1rem; margin-top:2rem;">
              <button class="btn btn-primary" style="flex:1;" onclick="pages.wallet.showAddFunds()"><i data-lucide="plus-circle"></i> Add Funds</button>
              <button class="btn btn-secondary" style="flex:1;" onclick="pages.wallet.showWithdraw()"><i data-lucide="arrow-down-to-line"></i> Withdraw</button>
            </div>
          </div>

          <div class="glass-card">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
               <p style="color:var(--text-secondary); text-transform:uppercase; font-size:0.8rem; letter-spacing:1px;">Locked in Escrow</p>
               <i data-lucide="lock" style="color:var(--accent-pink);"></i>
            </div>
            <h2 style="font-size:2rem; margin:0; font-family:var(--font-heading);">${ui.formatCurrency(w.escrow_balance)}</h2>
            <p style="color:var(--text-secondary); font-size:0.9rem; margin-top: 1rem;">Funds securely held for pending orders.</p>
          </div>
          
        </div>
      `;

      const txHtml = txData.transactions.length === 0 
        ? `<p style="color:var(--text-secondary); text-align:center; padding:2rem;">No transactions yet.</p>`
        : `<div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-light); color:var(--text-secondary);">
                  <th style="padding:1rem 0;">Date</th>
                  <th style="padding:1rem 0;">Description</th>
                  <th style="padding:1rem 0;">Type</th>
                  <th style="padding:1rem 0; text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${txData.transactions.map(t => {
                  const isPositive = t.amount > 0;
                  const color = isPositive ? 'var(--status-success)' : (t.type === 'escrow_hold' ? 'var(--status-warning)' : 'var(--text-primary)');
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding:1rem 0; white-space:nowrap; color:var(--text-secondary);">${ui.formatDate(t.created_at)}</td>
                      <td style="padding:1rem 0;">${t.description}</td>
                      <td style="padding:1rem 0;"><span class="badge" style="border:1px solid var(--border-light);">${t.type.replace('_',' ')}</span></td>
                      <td style="padding:1rem 0; text-align:right; color:${color}; font-family:var(--font-heading); font-weight:600;">
                        ${isPositive ? '+' : ''}${ui.formatCurrency(t.amount)}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
           </div>`;
           
      document.getElementById('wallet-transactions').innerHTML = txHtml;
      lucide.createIcons();
    } catch (err) {}
  },

  showAddFunds() {
    ui.openModal('Add Funds (Mock Demo)', `
      <form id="add-funds-form">
        <div class="form-group">
          <label>Amount (INR)</label>
          <input type="number" id="af-amount" class="form-control" required min="100" step="100" value="1000">
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <select id="af-method" class="form-control">
            <option value="upi">UPI / GPay / PhonePe</option>
            <option value="card">Credit / Debit Card</option>
            <option value="netbanking">Net Banking</option>
          </select>
        </div>
        <div style="padding: 1rem; background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.3); border-radius:8px; margin-bottom:1.5rem; color:var(--accent-cyan); font-size:0.9rem;">
          <i data-lucide="info" style="width:16px; height:16px; margin-bottom:-3px;"></i> No real money will be deducted. This simulates Razorpay/Stripe checkout.
        </div>
        <button type="submit" class="btn btn-primary btn-full">Pay Securely</button>
      </form>
    `);

    document.getElementById('add-funds-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      document.querySelector('#add-funds-form button').innerHTML = 'Processing...';
      try {
        await api.post('/wallet/add', {
          amount: parseFloat(document.getElementById('af-amount').value),
          method: document.getElementById('af-method').value
        });
        ui.closeModal();
        ui.showToast('Funds added successfully!', 'success');
        this.loadData();
      } catch (err) {}
    });
    lucide.createIcons();
  },
  
  showWithdraw() {
    ui.openModal('Withdraw Funds', `
      <form id="withdraw-form">
        <div class="form-group">
          <label>Amount to withdraw (INR)</label>
          <input type="number" id="wd-amount" class="form-control" required min="500">
        </div>
        <div class="form-group">
          <label>Bank Account Details / UPI ID</label>
          <input type="text" id="wd-bank" class="form-control" required placeholder="e.g. user@okhdfcbank">
        </div>
        <button type="submit" class="btn btn-primary btn-full">Request Withdrawal</button>
      </form>
    `);

    document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.post('/wallet/withdraw', {
          amount: parseFloat(document.getElementById('wd-amount').value),
          bankDetails: document.getElementById('wd-bank').value
        });
        ui.closeModal();
        ui.showToast('Withdrawal initiated! Processing takes 2-3 days.', 'success');
        this.loadData();
      } catch (err) {}
    });
  }
};
