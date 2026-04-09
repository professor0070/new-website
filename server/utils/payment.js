/**
 * Mock Payment Processor
 * 
 * Simulates Razorpay/Stripe payment flows.
 * In production, replace with real SDK calls.
 */

function processPayment(amount, method = 'upi', currency = 'INR') {
  // Simulate payment processing
  return {
    success: true,
    transaction_id: 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    amount,
    currency,
    method,
    provider: method === 'upi' ? 'razorpay' : 'stripe',
    timestamp: new Date().toISOString(),
    status: 'completed'
  };
}

function processRefund(transactionId, amount) {
  return {
    success: true,
    refund_id: 'RFD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    original_transaction: transactionId,
    amount,
    timestamp: new Date().toISOString(),
    status: 'refunded'
  };
}

function processWithdrawal(amount, bankDetails) {
  return {
    success: true,
    withdrawal_id: 'WDR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    amount,
    bank: bankDetails || 'Mock Bank Account',
    timestamp: new Date().toISOString(),
    status: 'processing',
    estimated_arrival: '2-3 business days'
  };
}

module.exports = { processPayment, processRefund, processWithdrawal };
