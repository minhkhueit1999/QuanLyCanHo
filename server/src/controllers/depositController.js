import Deposit from '../models/Deposit.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { isValidObjectId, runInTransaction, sessionOpts } from '../config/db.js';
import { decToNumber, toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { confirmDepositTransaction } from '../services/transactionServices.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';

function genDepositCode() {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `DEP-${ym}-${rand}`;
}

/**
 * POST /api/v1/deposits
 * User (or staff on behalf of user) creates deposit holding room:
 * - qr_transfer: 15 minutes
 * - cash: 24 hours
 */
export const createDeposit = asyncHandler(async (req, res) => {
  const { room_id, user_id, amount, paymentMethod = 'qr_transfer', note = '' } = req.body;

  if (!isValidObjectId(room_id)) throw new AppError('Mã phòng không hợp lệ', 400);
  if (!['qr_transfer', 'cash'].includes(paymentMethod)) {
    throw new AppError('Phương thức cọc phải là qr_transfer hoặc cash', 400);
  }

  const result = await runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const roomQuery = { _id: room_id, status: 'available' };
    if (req.user.role !== 'user') {
      roomQuery.tenantId = req.user.tenantId;
      if (req.buildingId) roomQuery.building_id = req.buildingId;
    } else {
      roomQuery.isPublished = true;
      roomQuery.approvalStatus = 'approved';
    }

    // Atomic conditional lock on available room
    const room = await Room.findOneAndUpdate(
      roomQuery,
      { $set: { status: 'reserved' } },
      { new: true, ...opts }
    );

    if (!room) {
      throw new AppError('Phòng không còn trống hoặc chưa được mở cho thuê', 400);
    }

    let targetUserId = req.user._id;
    if (['admin', 'manager'].includes(req.user.role) && user_id) {
      if (!isValidObjectId(user_id)) throw new AppError('Mã người đặt cọc không hợp lệ', 400);
      targetUserId = user_id;
    }

    const holdMinutes = paymentMethod === 'qr_transfer' ? 15 : 24 * 60;
    const holdExpiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    const depositAmt = Number(amount) > 0 ? Number(amount) : decToNumber(room.base_price);

    const deposit = new Deposit({
      tenantId: room.tenantId,
      building_id: room.building_id,
      room_id: room._id,
      user_id: targetUserId,
      depositCode: genDepositCode(),
      amount: toDecimal128(depositAmt),
      paymentMethod,
      status: 'pending_payment',
      hold_expires_at: holdExpiresAt,
      createdBy: req.user._id,
      note: String(note || '').trim(),
    });
    await deposit.save(opts);

    await User.updateOne(
      { _id: targetUserId, userStatus: 'guest' },
      { $set: { userStatus: 'depositor' } },
      opts
    );

    return deposit;
  });

  res.status(201).json({
    success: true,
    message:
      paymentMethod === 'qr_transfer'
        ? 'Đã giữ phòng 15 phút để quét QR chuyển khoản tiền cọc'
        : 'Đã giữ phòng 24 giờ cho thanh toán cọc tiền mặt',
    data: result,
  });
});

/**
 * GET /api/v1/deposits/my
 */
export const getMyDeposits = asyncHandler(async (req, res) => {
  const deposits = await Deposit.find({ user_id: req.user._id })
    .populate({ path: 'building_id', select: 'name address province_name' })
    .populate({ path: 'room_id', select: 'roomCode floor area base_price' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: deposits });
});

/**
 * GET /api/v1/deposits/building
 */
export const getBuildingDeposits = asyncHandler(async (req, res) => {
  const deposits = await Deposit.find({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  })
    .populate({
      path: 'room_id',
      match: { tenantId: req.user.tenantId, building_id: req.buildingId },
      select: 'roomCode floor base_price status',
    })
    .populate({ path: 'user_id', select: 'fullName email phone userStatus' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: deposits });
});

/**
 * PATCH /api/v1/deposits/:id/submit-proof
 * User uploads/submits transfer proof -> locks auto-cancel by setting status = 'payment_verifying'.
 */
export const submitDepositProof = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu cọc không hợp lệ', 400);

  const deposit = await Deposit.findOne({ _id: id, user_id: req.user._id });
  if (!deposit) throw new AppError('Không tìm thấy phiếu cọc của bạn', 404);
  if (!['pending_payment', 'payment_verifying'].includes(deposit.status)) {
    throw new AppError('Phiếu cọc không còn ở trạng thái chờ thanh toán', 400);
  }

  deposit.paymentProofUrl = String(req.body.paymentProofUrl || 'Đã chuyển khoản QR').trim();
  deposit.status = 'payment_verifying';
  await deposit.save();

  res.status(200).json({
    success: true,
    message: 'Đã gửi minh chứng thanh toán. Hệ thống đã tạm khóa tự hủy giữ chỗ để chờ xác nhận.',
    data: deposit,
  });
});

/**
 * POST /api/v1/deposits/:id/confirm
 * Admin/Manager confirms deposit received (ACID transaction).
 */
export const confirmDeposit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu cọc không hợp lệ', 400);

  const result = await confirmDepositTransaction({
    req,
    depositId: id,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
  });

  res.status(200).json({
    success: true,
    message: 'Đã xác nhận nhận tiền cọc và giữ chỗ thành công',
    data: result,
  });
});

/**
 * POST /api/v1/deposits/:id/refund
 * Sensitive action: Admin only + AuditLog. Refunds held deposit and releases room.
 */
export const refundDeposit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu cọc không hợp lệ', 400);

  const { refundAmount, reason } = req.body;
  if (!reason || !String(reason).trim()) {
    throw new AppError('Thao tác hoàn cọc nhạy cảm bắt buộc phải nhập lý do cho Audit Log', 400);
  }

  const updated = await runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const deposit = await Deposit.findOne(
      { _id: id, tenantId: req.user.tenantId, building_id: req.buildingId },
      null,
      opts
    );
    if (!deposit) throw new AppError('Không tìm thấy phiếu cọc', 404);
    if (!['held', 'refund_pending'].includes(deposit.status)) {
      throw new AppError('Chỉ có thể hoàn cọc với phiếu ở trạng thái đang giữ (held)', 400);
    }

    const before = { status: deposit.status, amount: decToNumber(deposit.amount) };
    const finalRefund =
      refundAmount !== undefined ? Number(refundAmount) : decToNumber(deposit.amount);

    deposit.status = 'refunded';
    deposit.refundAmount = toDecimal128(finalRefund);
    deposit.refundReason = String(reason).trim();
    deposit.approvedBy = req.user._id;
    await deposit.save(opts);

    await Room.updateOne(
      { _id: deposit.room_id, tenantId: req.user.tenantId, building_id: req.buildingId, status: 'reserved' },
      { $set: { status: 'available' } },
      opts
    );

    await recordAuditLog({
      req,
      tenantId: req.user.tenantId,
      buildingId: req.buildingId,
      action: 'REFUND_DEPOSIT',
      targetModel: 'Deposit',
      targetId: deposit._id,
      reason: String(reason).trim(),
      beforeState: before,
      afterState: { status: 'refunded', refundAmount: finalRefund },
      session,
    });

    return deposit;
  });

  res.status(200).json({
    success: true,
    message: 'Đã duyệt hoàn tiền cọc và mở lại phòng trống',
    data: updated,
  });
});

/**
 * POST /api/v1/deposits/:id/forfeit
 * Forfeits deposit when depositor abandons or cancels without refund approval.
 */
export const forfeitDeposit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu cọc không hợp lệ', 400);

  const deposit = await Deposit.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!deposit) throw new AppError('Không tìm thấy phiếu cọc', 404);
  if (!['held', 'pending_payment', 'payment_verifying'].includes(deposit.status)) {
    throw new AppError('Không thể hủy phiếu cọc ở trạng thái hiện tại', 400);
  }

  deposit.status = deposit.status === 'held' ? 'forfeited' : 'cancelled';
  deposit.note = req.body.reason || 'Hủy giữ chỗ / Mất cọc';
  await deposit.save();

  await Room.updateOne(
    { _id: deposit.room_id, tenantId: req.user.tenantId, building_id: req.buildingId, status: 'reserved' },
    { $set: { status: 'available' } }
  );

  res.status(200).json({
    success: true,
    message: 'Đã hủy phiếu cọc và giải phóng phòng',
    data: deposit,
  });
});
