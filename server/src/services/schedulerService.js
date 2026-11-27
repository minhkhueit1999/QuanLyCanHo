import Deposit from '../models/Deposit.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import Commission from '../models/Commission.js';
import Building from '../models/Building.js';
import { decToNumber, roundMoney, toDecimal128 } from '../utils/decimal.js';

let intervalHandle = null;

/**
 * Execute scheduled background sweeps:
 * 1. Expire unpaid deposits past hold_expires_at (skips 'payment_verifying')
 * 2. Mark due/overdue invoice reminders & compute daily late fees
 * 3. Mark 45-day contract renewal reminders
 * 4. Flag overdue Manager cash remittances past 24h deadline
 * 5. Move closed month provisional commissions into pending_approval
 */
export async function runScheduledJobs() {
  const now = new Date();
  const report = {
    executedAt: now.toISOString(),
    expiredDeposits: 0,
    invoicesBefore3Days: 0,
    invoicesOnDueDate: 0,
    invoicesMarkedOverdue: 0,
    contractRenewalReminders: 0,
    overdueManagerCashPayments: 0,
    commissionsMovedToApproval: 0,
  };

  // 1. Expire stale pending_payment deposits (NEVER expire payment_verifying!)
  const expiredDeposits = await Deposit.find({
    status: 'pending_payment',
    hold_expires_at: { $lt: now },
  });

  for (const dep of expiredDeposits) {
    dep.status = 'expired';
    await dep.save();
    await Room.updateOne(
      { _id: dep.room_id, tenantId: dep.tenantId, status: 'reserved' },
      { $set: { status: 'available' } }
    );
    const activeOther = await Deposit.countDocuments({
      user_id: dep.user_id,
      status: { $in: ['held', 'payment_verifying'] },
    });
    if (activeOther === 0) {
      await User.updateOne(
        { _id: dep.user_id, userStatus: 'depositor' },
        { $set: { userStatus: 'guest' } }
      );
    }
    report.expiredDeposits += 1;
  }

  // 2. Invoice reminders & overdue marking
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const before3Res = await Invoice.updateMany(
    {
      status: { $in: ['unpaid', 'partial'] },
      dueDate: { $gt: endOfToday, $lte: in3Days },
      'remindersSent.before3Days': false,
    },
    { $set: { 'remindersSent.before3Days': true } }
  );
  report.invoicesBefore3Days = before3Res.modifiedCount || 0;

  const onDueRes = await Invoice.updateMany(
    {
      status: { $in: ['unpaid', 'partial'] },
      dueDate: { $gte: startOfToday, $lt: endOfToday },
      'remindersSent.onDueDate': false,
    },
    { $set: { 'remindersSent.onDueDate': true } }
  );
  report.invoicesOnDueDate = onDueRes.modifiedCount || 0;

  const overdueInvoices = await Invoice.find({
    status: { $in: ['unpaid', 'partial', 'overdue'] },
    dueDate: { $lt: startOfToday },
    lateFeeWaived: false,
  });

  for (const inv of overdueInvoices) {
    const daysLate = Math.max(
      1,
      Math.floor((startOfToday - new Date(inv.dueDate)) / (24 * 60 * 60 * 1000))
    );
    const bld = await Building.findOne({ _id: inv.building_id, tenantId: inv.tenantId }).lean();
    const dailyRate = decToNumber(bld?.pricingConfig?.lateFeeDailyRate) || 50000;
    const expectedLateFee = roundMoney(daysLate * dailyRate);
    const currentLateFee = decToNumber(inv.lateFee);

    if (inv.status !== 'overdue' || expectedLateFee > currentLateFee) {
      const delta = roundMoney(expectedLateFee - currentLateFee);
      inv.lateFee = toDecimal128(expectedLateFee);
      inv.totalAmount = toDecimal128(roundMoney(decToNumber(inv.totalAmount) + delta));
      inv.remainingAmount = toDecimal128(roundMoney(decToNumber(inv.remainingAmount) + delta));
      inv.status = 'overdue';
      inv.remindersSent.overdue = true;
      await inv.save();
      report.invoicesMarkedOverdue += 1;
    }
  }

  // 3. Contract 45-day renewal reminder
  const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const renewalRes = await Contract.updateMany(
    {
      status: 'active',
      endDate: { $lte: in45Days },
      renewalReminderSentAt: null,
    },
    { $set: { renewalReminderSentAt: now } }
  );
  report.contractRenewalReminders = renewalRes.modifiedCount || 0;

  // 4. Manager 24h cash remit overdue check
  const cashRes = await Payment.updateMany(
    {
      cashRemitStatus: 'held_by_manager',
      remitDueAt: { $lt: now },
      status: 'confirmed',
    },
    { $set: { cashRemitStatus: 'overdue_remit' } }
  );
  report.overdueManagerCashPayments = cashRes.modifiedCount || 0;

  // 5. Move closed-month provisional commissions to pending_approval
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const commRes = await Commission.updateMany(
    {
      period: { $lt: currentPeriod },
      status: 'provisional',
    },
    { $set: { status: 'pending_approval' } }
  );
  report.commissionsMovedToApproval = commRes.modifiedCount || 0;

  return report;
}

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER === 'false' || intervalHandle) return;
  const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS) || 60000;

  intervalHandle = setInterval(() => {
    runScheduledJobs().catch((err) => {
      console.error('[Scheduler] Background sweep error:', err.message);
    });
  }, intervalMs);

  // Run one initial non-blocking sweep after startup
  setTimeout(() => {
    runScheduledJobs().catch((err) => {
      console.error('[Scheduler] Initial sweep error:', err.message);
    });
  }, 3000);
}

export function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
