/**
 * Escrow State Machine
 *
 * States: pending → escrow_held → delivered → confirmed → released
 *                                           → disputed → resolved_buyer (refunded) / resolved_seller (released)
 *
 * Auto-confirm: 72 hours after delivery (simulated)
 */

const ESCROW_AUTO_CONFIRM_HOURS = 72;

const VALID_TRANSITIONS = {
  'pending': ['escrow_held', 'cancelled'],
  'escrow_held': ['delivered', 'cancelled'],
  'delivered': ['confirmed', 'disputed'],
  'confirmed': ['released'],
  'disputed': ['refunded', 'released'],
};

function canTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed && allowed.includes(newStatus);
}

function getAutoConfirmTime() {
  const date = new Date();
  date.setHours(date.getHours() + ESCROW_AUTO_CONFIRM_HOURS);
  return date.toISOString();
}

function shouldAutoConfirm(autoConfirmAt) {
  if (!autoConfirmAt) return false;
  return new Date() >= new Date(autoConfirmAt);
}

module.exports = { canTransition, getAutoConfirmTime, shouldAutoConfirm, VALID_TRANSITIONS };
