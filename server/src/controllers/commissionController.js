import Commission from '../models/Commission.js';
import { isValidObjectId } from '../config/db.js';
import { decToNumber } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';

/**
 * GET /api/v1/commissions/building
 * Admin sees all managers' commissions in building; Manager sees only their own.
 */
export const getBuildingCommissions = asyncHandler(async (req, res) => {
  const { period, status } = req.query;
  const filter = {
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  };
  if (req.user.role === 'manager') {
    filter.manager_id = req.user._id;
  }
  if (period && String(period).trim()) filter.period = String(period).trim();
  if (status && status !== 'ALL') filter.status = String(status);

  const list = await Commission.find(filter)
    .populate({ path: 'manager_id', select: 'fullName email phone' })
    .populate({ path: 'invoice_id', select: 'invoiceCode billing_month totalAmount' })
    .populate({ path: 'payment_id', select: 'transactionCode method amount' })
    .sort({ period: -1, createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: list });
});

/**
 * POST /api/v1/commissions/:id/dispute
 * Manager submits reconciliation dispute within reconciliation window.
 */
export const disputeCommission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã hoa hồng không hợp lệ', 400);
  if (!reason || !String(reason).trim()) throw new AppError('Vui lòng nhập lý do khiếu nại', 400);

  const commission = await Commission.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    manager_id: req.user._id,
  });

  if (!commission) throw new AppError('Không tìm thấy khoản hoa hồng của bạn', 404);
  if (commission.status === 'paid') {
    throw new AppError('Hoa hồng đã chi trả không thể khiếu nại', 400);
  }

  commission.status = 'disputed';
  commission.disputeReason = String(reason).trim();
  await commission.save();

  res.status(200).json({
    success: true,
    message: 'Đã gửi khiếu nại đối soát hoa hồng lên Admin',
    data: commission,
  });
});

/**
 * PATCH /api/v1/commissions/:id/status
 * Admin only (super_admin or accountant). Moves to approved or paid (day 10 payout).
 */
export const updateCommissionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolution = '' } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã hoa hồng không hợp lệ', 400);
  if (!['pending_approval', 'approved', 'paid'].includes(status)) {
    throw new AppError('Trạng thái duyệt hoa hồng không hợp lệ', 400);
  }

  const commission = await Commission.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!commission) throw new AppError('Không tìm thấy khoản hoa hồng', 404);

  const prevStatus = commission.status;
  commission.status = status;
  if (resolution) commission.disputeResolution = String(resolution).trim();
  if (status === 'approved') commission.approvedBy = req.user._id;
  if (status === 'paid') {
    commission.approvedBy = commission.approvedBy || req.user._id;
    commission.paidAt = new Date();
  }
  await commission.save();

  await recordAuditLog({
    req,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
    action: status === 'paid' ? 'COMMISSION_PAYOUT' : 'COMMISSION_APPROVE',
    targetModel: 'Commission',
    targetId: commission._id,
    reason: resolution || `Chuyển trạng thái hoa hồng sang ${status}`,
    beforeState: { status: prevStatus, amount: decToNumber(commission.commissionAmount) },
    afterState: { status },
  });

  res.status(200).json({
    success: true,
    message:
      status === 'paid'
        ? 'Đã xác nhận chi trả hoa hồng (Ngày 10)'
        : 'Đã duyệt đối soát hoa hồng',
    data: commission,
  });
});
