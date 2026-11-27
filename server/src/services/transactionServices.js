import mongoose from 'mongoose';
import Building from '../models/Building.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import Deposit from '../models/Deposit.js';
import Contract from '../models/Contract.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Commission from '../models/Commission.js';
import ServiceTicket from '../models/ServiceTicket.js';
import { runInTransaction, sessionOpts } from '../config/db.js';
import { decToNumber, roundMoney, toDecimal128 } from '../utils/decimal.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';
import { AppError } from '../middlewares/errorHandler.js';

function genCode(prefix) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${ym}-${rand}`;
}

/**
 * Confirm deposit payment inside ACID transaction:
 * - Deposit -> held
 * - Room -> reserved
 * - User -> depositor (if guest)
 */
export async function confirmDepositTransaction({ req, depositId, tenantId, buildingId }) {
  return runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const deposit = await Deposit.findOne(
      { _id: depositId, tenantId, building_id: buildingId },
      null,
      opts
    );

    if (!deposit) throw new AppError('Không tìm thấy phiếu cọc', 404);
    if (!['pending_payment', 'payment_verifying'].includes(deposit.status)) {
      throw new AppError(`Phiếu cọc đang ở trạng thái "${deposit.status}", không thể xác nhận`, 400);
    }

    const room = await Room.findOne(
      { _id: deposit.room_id, tenantId, building_id: buildingId },
      null,
      opts
    );
    if (!room) throw new AppError('Không tìm thấy phòng thuộc phiếu cọc', 404);

    deposit.status = 'held';
    deposit.approvedBy = req.user._id;
    await deposit.save(opts);

    if (room.status === 'available' || room.status === 'reserved') {
      room.status = 'reserved';
      await room.save(opts);
    }

    await User.updateOne(
      { _id: deposit.user_id, userStatus: 'guest' },
      { $set: { userStatus: 'depositor' } },
      opts
    );

    // Record deposit payment ledger entry
    const payment = new Payment({
      tenantId,
      building_id: buildingId,
      deposit_id: deposit._id,
      user_id: deposit.user_id,
      transactionCode: genCode('PAYD'),
      method: deposit.paymentMethod,
      expectedAmount: deposit.amount,
      amount: deposit.amount,
      discrepancyType: 'exact',
      collectedBy: deposit.paymentMethod === 'cash' ? req.user._id : null,
      cashRemitStatus:
        deposit.paymentMethod === 'cash' && req.user.role === 'manager'
          ? 'held_by_manager'
          : 'not_applicable',
      remitDueAt:
        deposit.paymentMethod === 'cash' && req.user.role === 'manager'
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : null,
      confirmedBy: req.user._id,
      status: 'confirmed',
      note: `Thu tiền cọc giữ chỗ ${deposit.depositCode}`,
    });
    await payment.save(opts);

    await recordAuditLog({
      req,
      tenantId,
      buildingId,
      action: 'CONFIRM_DEPOSIT',
      targetModel: 'Deposit',
      targetId: deposit._id,
      afterState: { status: deposit.status, amount: decToNumber(deposit.amount) },
      session,
    });

    return { deposit, payment };
  });
}

/**
 * Activate contract + handover inside ACID transaction:
 * - Validates maxOccupants & discountLimit (Admin approval required if exceeded)
 * - Links & converts Deposit if provided
 * - Snapshots building pricing & Manager commission rate
 * - Sets Room status = occupied & User userStatus = resident
 */
export async function activateContractTransaction({
  req,
  tenantId,
  building,
  roomId,
  userId,
  depositId,
  occupants,
  vehicles = [],
  monthlyRent,
  discountAmount = 0,
  depositAmount = 0,
  startDate,
  endDate,
  signatureText = '',
  signedDocumentUrl = '',
  handover = {},
}) {
  return runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const room = await Room.findOne(
      { _id: roomId, tenantId, building_id: building._id },
      null,
      opts
    );
    if (!room) throw new AppError('Không tìm thấy phòng trong tòa nhà', 404);
    if (room.status === 'occupied' || room.status === 'maintenance') {
      throw new AppError(`Phòng ${room.roomCode} hiện ở trạng thái "${room.status}", không thể lập hợp đồng`, 400);
    }

    if (!Array.isArray(occupants) || occupants.length === 0) {
      throw new AppError('Hợp đồng phải có ít nhất 1 cư dân đại diện', 400);
    }
    if (occupants.length > room.maxOccupants) {
      throw new AppError(
        `Số người ở (${occupants.length}) vượt quá giới hạn tối đa của phòng (${room.maxOccupants} người)`,
        400
      );
    }

    const discountNum = roundMoney(discountAmount);
    const discountLimitNum = decToNumber(room.discountLimit);
    if (discountNum > discountLimitNum && req.user.role !== 'admin') {
      throw new AppError(
        `Giảm giá ${discountNum.toLocaleString('vi-VN')}đ vượt hạn mức Manager (${discountLimitNum.toLocaleString('vi-VN')}đ). Cần Admin phê duyệt.`,
        403
      );
    }

    let linkedDeposit = null;
    let effectiveDepositAmount = roundMoney(depositAmount);
    if (depositId) {
      linkedDeposit = await Deposit.findOne(
        { _id: depositId, tenantId, building_id: building._id },
        null,
        opts
      );
      if (!linkedDeposit) throw new AppError('Không tìm thấy phiếu cọc liên kết', 404);
      if (linkedDeposit.status !== 'held') {
        throw new AppError('Phiếu cọc chưa ở trạng thái đã giữ chỗ (held)', 400);
      }
      effectiveDepositAmount = decToNumber(linkedDeposit.amount);
      linkedDeposit.status = 'converted_to_contract';
      await linkedDeposit.save(opts);
    }

    const targetUser = await User.findOne({ _id: userId }, null, opts);
    if (!targetUser) throw new AppError('Không tìm thấy tài khoản cư dân', 404);

    // Determine Manager commission rate priority: Manager override -> Building default -> 5%
    let commissionRate = decToNumber(building.commissionConfig?.defaultCommissionRate) || 5;
    if (building.primaryManagerId) {
      const mgr = await User.findOne({ _id: building.primaryManagerId, tenantId }, null, opts);
      if (mgr?.managerConfig?.commissionRateOverride !== null && mgr?.managerConfig?.commissionRateOverride !== undefined) {
        commissionRate = decToNumber(mgr.managerConfig.commissionRateOverride);
      }
    }

    const contract = new Contract({
      tenantId,
      building_id: building._id,
      room_id: room._id,
      user_id: targetUser._id,
      deposit_id: linkedDeposit ? linkedDeposit._id : null,
      contractCode: genCode('HD'),
      occupants,
      vehicles,
      monthlyRent: toDecimal128(monthlyRent ?? decToNumber(room.base_price)),
      discountAmount: toDecimal128(discountNum),
      discountApprovedBy: discountNum > discountLimitNum ? req.user._id : null,
      depositAmount: toDecimal128(effectiveDepositAmount),
      pricingSnapshot: {
        electricityPrice: building.pricingConfig.electricityPrice,
        waterPrice: building.pricingConfig.waterPrice,
        managementFee: building.pricingConfig.managementFee,
        parkingFeeMotorbike: building.pricingConfig.parkingFeeMotorbike,
        parkingFeeCar: building.pricingConfig.parkingFeeCar,
        lateFeeDailyRate: building.pricingConfig.lateFeeDailyRate,
      },
      commissionRateSnapshot: toDecimal128(commissionRate),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      signedAt: new Date(),
      signatureText: signatureText || targetUser.fullName,
      signedDocumentUrl: String(signedDocumentUrl || '').trim(),
      handover: {
        elecInitial: Number(handover.elecInitial) || 0,
        waterInitial: Number(handover.waterInitial) || 0,
        keysGiven: Number(handover.keysGiven ?? room.keysAndCards?.mechanicalKeys ?? 2),
        cardsGiven: Number(handover.cardsGiven ?? room.keysAndCards?.keyCards ?? 2),
        assetsSnapshot: room.assets || [],
        handedOverAt: new Date(),
        note: handover.note || '',
      },
      status: 'active',
    });

    await contract.save(opts);

    room.status = 'occupied';
    await room.save(opts);

    targetUser.userStatus = 'resident';
    await targetUser.save(opts);

    if (discountNum > discountLimitNum) {
      await recordAuditLog({
        req,
        tenantId,
        buildingId: building._id,
        action: 'APPROVE_DISCOUNT',
        targetModel: 'Contract',
        targetId: contract._id,
        reason: `Duyệt giảm giá vượt hạn mức: ${discountNum}đ`,
        afterState: { discountAmount: discountNum },
        session,
      });
    }

    return contract;
  });
}

/**
 * Record Invoice Payment + Manager Cash Limit Guard + Proportional Commission inside ACID transaction.
 */
export async function recordInvoicePaymentTransaction({
  req,
  tenantId,
  building,
  invoiceId,
  method,
  amount,
  referenceNote = '',
  wrongCodeFlag = false,
}) {
  return runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const invoice = await Invoice.findOne(
      { _id: invoiceId, tenantId, building_id: building._id },
      null,
      opts
    );

    if (!invoice) throw new AppError('Không tìm thấy hóa đơn', 404);
    if (['paid', 'cancelled'].includes(invoice.status)) {
      throw new AppError(`Hóa đơn đang ở trạng thái "${invoice.status}", không thể ghi nhận thêm thanh toán`, 400);
    }

    const contract = await Contract.findOne(
      { _id: invoice.contract_id, tenantId, building_id: building._id },
      null,
      opts
    );
    if (!contract) throw new AppError('Không tìm thấy hợp đồng của hóa đơn', 404);

    const payAmount = roundMoney(amount);
    if (payAmount <= 0) throw new AppError('Số tiền thanh toán phải lớn hơn 0', 400);

    const remainingBefore = decToNumber(invoice.remainingAmount);

    // Check Manager Cash Limit when Manager collects cash
    const isManagerCash = req.user.role === 'manager' && method === 'cash';
    if (isManagerCash) {
      const heldAgg = await Payment.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            collectedBy: new mongoose.Types.ObjectId(req.user._id),
            cashRemitStatus: { $in: ['held_by_manager', 'overdue_remit'] },
            status: 'confirmed',
          },
        },
      ]);
      const currentlyHeld = heldAgg.reduce((sum, p) => sum + decToNumber(p.amount), 0);
      const cashLimit =
        decToNumber(req.user.managerConfig?.cashLimit) ||
        decToNumber(building.commissionConfig?.managerCashLimit) ||
        50000000;

      if (currentlyHeld + payAmount > cashLimit) {
        throw new AppError(
          `Vượt hạn mức giữ tiền mặt (${cashLimit.toLocaleString('vi-VN')}đ). Hiện đang giữ ${currentlyHeld.toLocaleString('vi-VN')}đ. Vui lòng nộp tiền mặt về công ty trước.`,
          400
        );
      }
    }

    let discrepancyType = 'exact';
    let overpaidCredit = 0;
    let appliedAmount = payAmount;

    if (wrongCodeFlag) {
      discrepancyType = 'wrong_code';
    } else if (payAmount < remainingBefore) {
      discrepancyType = 'underpaid';
    } else if (payAmount > remainingBefore) {
      discrepancyType = 'overpaid';
      overpaidCredit = roundMoney(payAmount - remainingBefore);
      appliedAmount = remainingBefore;
    }

    const remitHours = building.commissionConfig?.cashRemitDeadlineHours || 24;
    const payment = new Payment({
      tenantId,
      building_id: building._id,
      invoice_id: invoice._id,
      user_id: invoice.user_id,
      transactionCode: genCode('PAY'),
      referenceNote,
      method,
      expectedAmount: toDecimal128(remainingBefore),
      amount: toDecimal128(payAmount),
      discrepancyType,
      overpaidCredit: toDecimal128(overpaidCredit),
      collectedBy: method === 'cash' ? req.user._id : null,
      cashRemitStatus: isManagerCash ? 'held_by_manager' : 'not_applicable',
      remitDueAt: isManagerCash ? new Date(Date.now() + remitHours * 60 * 60 * 1000) : null,
      confirmedBy: wrongCodeFlag ? null : req.user._id,
      status: wrongCodeFlag ? 'pending' : 'confirmed',
      note:
        discrepancyType === 'overpaid'
          ? `Chuyển dư ${overpaidCredit.toLocaleString('vi-VN')}đ (ghi nhận cấn trừ kỳ sau)`
          : discrepancyType === 'underpaid'
            ? 'Thanh toán một phần'
            : discrepancyType === 'wrong_code'
              ? 'Chuyển khoản sai mã giao dịch — chờ Admin đối soát'
              : 'Thanh toán khớp hóa đơn',
    });

    await payment.save(opts);

    let commission = null;
    if (!wrongCodeFlag) {
      const newPaid = roundMoney(decToNumber(invoice.paidAmount) + appliedAmount);
      const totalInvoice = decToNumber(invoice.totalAmount);
      const newRemaining = Math.max(0, roundMoney(totalInvoice - newPaid));

      invoice.paidAmount = toDecimal128(newPaid);
      invoice.remainingAmount = toDecimal128(newRemaining);
      invoice.status = newRemaining === 0 ? 'paid' : 'partial';
      if (newRemaining === 0) invoice.paidAt = new Date();
      await invoice.save(opts);

      // Proportional Commission on Room Fee Collected (with automatic mid-month Manager handover split)
      if (building.primaryManagerId && totalInvoice > 0) {
        const roomFeeTotal = decToNumber(invoice.roomFee);
        const roomFeeShare = roundMoney((appliedAmount / totalInvoice) * roomFeeTotal);
        const rate = decToNumber(contract.commissionRateSnapshot) || 5;
        const totalCommAmt = roundMoney((roomFeeShare * rate) / 100);

        if (totalCommAmt > 0) {
          const [yr, mo] = invoice.billing_month.split('-').map(Number);
          const payoutDate = new Date(yr, mo, 10);
          const disputeDeadline = new Date(yr, mo, 3);
          const daysInMonth = new Date(yr, mo, 0).getDate();

          // Check if a Manager handover happened inside this billing_month
          const handoverInMonth = (building.managerHandoverHistory || []).find((h) => {
            if (!h.handedOverAt || !h.fromManagerId) return false;
            const hd = new Date(h.handedOverAt);
            return hd.getFullYear() === yr && hd.getMonth() + 1 === mo;
          });

          if (handoverInMonth && handoverInMonth.fromManagerId.toString() !== handoverInMonth.toManagerId.toString()) {
            const splitDay = Math.max(1, Math.min(daysInMonth - 1, new Date(handoverInMonth.handedOverAt).getDate()));
            const ratioOld = splitDay / daysInMonth;
            const shareOldRoom = roundMoney(roomFeeShare * ratioOld);
            const shareNewRoom = roundMoney(roomFeeShare - shareOldRoom);
            const commOld = roundMoney(totalCommAmt * ratioOld);
            const commNew = roundMoney(totalCommAmt - commOld);

            const c1 = new Commission({
              tenantId,
              building_id: building._id,
              manager_id: handoverInMonth.fromManagerId,
              invoice_id: invoice._id,
              payment_id: payment._id,
              period: invoice.billing_month,
              roomFeeCollected: toDecimal128(shareOldRoom),
              commissionRate: toDecimal128(rate),
              commissionAmount: toDecimal128(commOld),
              status: 'provisional',
              disputeDeadline,
              payoutDate,
            });
            const c2 = new Commission({
              tenantId,
              building_id: building._id,
              manager_id: handoverInMonth.toManagerId,
              invoice_id: invoice._id,
              payment_id: payment._id,
              period: invoice.billing_month,
              roomFeeCollected: toDecimal128(shareNewRoom),
              commissionRate: toDecimal128(rate),
              commissionAmount: toDecimal128(commNew),
              status: 'provisional',
              disputeDeadline,
              payoutDate,
            });
            await c1.save(opts);
            await c2.save(opts);
            commission = c2;
          } else {
            commission = new Commission({
              tenantId,
              building_id: building._id,
              manager_id: building.primaryManagerId,
              invoice_id: invoice._id,
              payment_id: payment._id,
              period: invoice.billing_month,
              roomFeeCollected: toDecimal128(roomFeeShare),
              commissionRate: toDecimal128(rate),
              commissionAmount: toDecimal128(totalCommAmt),
              status: 'provisional',
              disputeDeadline,
              payoutDate,
            });
            await commission.save(opts);
          }
        }
      }
    }

    return { invoice, payment, commission };
  });
}

/**
 * Checkout & Deposit Settlement inside ACID transaction:
 * Formula: netRefund = depositAmount - unpaidDebt - finalUtilityAndFee - damageCompensation
 * Room transitions to 'maintenance' ready for inspection -> 'available'.
 */
export async function settleCheckoutTransaction({
  req,
  tenantId,
  buildingId,
  contractId,
  finalElecOld = 0,
  finalElecNew = 0,
  finalWaterOld = 0,
  finalWaterNew = 0,
  finalUtilityExtra = 0,
  damageCompensation = 0,
  note = '',
}) {
  return runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const contract = await Contract.findOne(
      { _id: contractId, tenantId, building_id: buildingId },
      null,
      opts
    );
    if (!contract) throw new AppError('Không tìm thấy hợp đồng', 404);
    if (!['active', 'checkout_requested'].includes(contract.status)) {
      throw new AppError('Hợp đồng không ở trạng thái có thể quyết toán trả phòng', 400);
    }

    const unpaidInvoices = await Invoice.find(
      {
        tenantId,
        building_id: buildingId,
        contract_id: contract._id,
        status: { $in: ['unpaid', 'partial', 'overdue'] },
      },
      null,
      opts
    );

    const unpaidDebt = roundMoney(
      unpaidInvoices.reduce((sum, inv) => sum + decToNumber(inv.remainingAmount), 0)
    );

    const elecPrice = decToNumber(contract.pricingSnapshot?.electricityPrice);
    const waterPrice = decToNumber(contract.pricingSnapshot?.waterPrice);
    const elecDiff = Math.max(0, Number(finalElecNew) - Number(finalElecOld));
    const waterDiff = Math.max(0, Number(finalWaterNew) - Number(finalWaterOld));
    const finalUtilityAndFee = roundMoney(
      elecDiff * elecPrice + waterDiff * waterPrice + (Number(finalUtilityExtra) || 0)
    );

    const depositAmt = decToNumber(contract.depositAmount);
    const dmgAmt = roundMoney(damageCompensation);
    const netRefund = roundMoney(depositAmt - unpaidDebt - finalUtilityAndFee - dmgAmt);

    contract.settlement = {
      finalElecOld: Number(finalElecOld) || 0,
      finalElecNew: Number(finalElecNew) || 0,
      finalWaterOld: Number(finalWaterOld) || 0,
      finalWaterNew: Number(finalWaterNew) || 0,
      finalUtilityAndFee: toDecimal128(finalUtilityAndFee),
      unpaidDebt: toDecimal128(unpaidDebt),
      damageCompensation: toDecimal128(dmgAmt),
      netRefund: toDecimal128(netRefund),
      settledAt: new Date(),
      settledBy: req.user._id,
      note,
    };
    contract.status = 'terminated';
    await contract.save(opts);

    await Room.updateOne(
      { _id: contract.room_id, tenantId, building_id: buildingId },
      { $set: { status: 'maintenance' } },
      opts
    );

    const otherActive = await Contract.countDocuments(
      { user_id: contract.user_id, status: { $in: ['active', 'checkout_requested'] }, _id: { $ne: contract._id } },
      opts
    );
    if (otherActive === 0) {
      await User.updateOne({ _id: contract.user_id }, { $set: { userStatus: 'former' } }, opts);
    }

    await recordAuditLog({
      req,
      tenantId,
      buildingId,
      action: 'SETTLE_CHECKOUT',
      targetModel: 'Contract',
      targetId: contract._id,
      reason: note || 'Quyết toán trả phòng',
      afterState: {
        depositAmt,
        unpaidDebt,
        finalUtilityAndFee,
        damageCompensation: dmgAmt,
        netRefund,
      },
      session,
    });

    return contract;
  });
}

/**
 * Primary Manager assignment & electronic handover report inside ACID transaction.
 */
export async function handoverBuildingManagerTransaction({
  req,
  tenantId,
  buildingId,
  newManagerId,
  note = '',
}) {
  return runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const building = await Building.findOne({ _id: buildingId, tenantId }, null, opts);
    if (!building) throw new AppError('Không tìm thấy tòa nhà', 404);

    const newManager = await User.findOne(
      { _id: newManagerId, tenantId, role: 'manager' },
      null,
      opts
    );
    if (!newManager) throw new AppError('Không tìm thấy tài khoản Manager nhận bàn giao', 404);

    const prevManagerId = building.primaryManagerId;

    const [activeContractsCount, unpaidInvoices, heldCashPayments, rooms, openTicketsCount] =
      await Promise.all([
        Contract.countDocuments({ tenantId, building_id: building._id, status: 'active' }, opts),
        Invoice.find(
          { tenantId, building_id: building._id, status: { $in: ['unpaid', 'partial', 'overdue'] } },
          null,
          opts
        ),
        prevManagerId
          ? Payment.find(
              {
                tenantId,
                building_id: building._id,
                collectedBy: prevManagerId,
                cashRemitStatus: { $in: ['held_by_manager', 'overdue_remit'] },
                status: 'confirmed',
              },
              null,
              opts
            )
          : [],
        Room.find({ tenantId, building_id: building._id }, null, opts),
        ServiceTicket.countDocuments(
          {
            tenantId,
            building_id: building._id,
            status: { $in: ['open', 'quoted', 'in_progress'] },
          },
          opts
        ),
      ]);

    const unpaidDebtTotal = roundMoney(
      unpaidInvoices.reduce((s, i) => s + decToNumber(i.remainingAmount), 0)
    );
    const cashHeld = roundMoney(
      heldCashPayments.reduce((s, p) => s + decToNumber(p.amount), 0)
    );

    const totalKeys = rooms.reduce((s, r) => s + (r.keysAndCards?.mechanicalKeys || 0), 0);
    const totalCards = rooms.reduce((s, r) => s + (r.keysAndCards?.keyCards || 0), 0);

    building.managerHandoverHistory.push({
      fromManagerId: prevManagerId,
      toManagerId: newManager._id,
      handedOverBy: req.user._id,
      handedOverAt: new Date(),
      activeContractsCount,
      unpaidDebtTotal: toDecimal128(unpaidDebtTotal),
      cashHeldByPreviousManager: toDecimal128(cashHeld),
      keysSummary: `${totalKeys} chìa khóa cơ, ${totalCards} thẻ từ (${rooms.length} phòng)`,
      openTicketsCount,
      note: note || 'Bàn giao quản lý chính thức',
    });

    building.primaryManagerId = newManager._id;
    await building.save(opts);

    // Ensure building is in newManager.assignedBuildings
    await User.updateOne(
      { _id: newManager._id, tenantId },
      { $addToSet: { assignedBuildings: building._id } },
      opts
    );

    await recordAuditLog({
      req,
      tenantId,
      buildingId: building._id,
      action: 'MANAGER_HANDOVER',
      targetModel: 'Building',
      targetId: building._id,
      reason: note || 'Chuyển giao Manager chính',
      beforeState: { primaryManagerId: prevManagerId },
      afterState: { primaryManagerId: newManager._id, unpaidDebtTotal, cashHeld },
      session,
    });

    return building;
  });
}
