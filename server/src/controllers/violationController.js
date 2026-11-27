import Violation from '../models/Violation.js';
import Contract from '../models/Contract.js';
import { isValidObjectId } from '../config/db.js';
import { toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * GET /api/v1/violations/building
 */
export const getBuildingViolations = asyncHandler(async (req, res) => {
  const violations = await Violation.find({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  })
    .populate({
      path: 'room_id',
      match: { tenantId: req.user.tenantId, building_id: req.buildingId },
      select: 'roomCode floor',
    })
    .populate({ path: 'user_id', select: 'fullName phone' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: violations });
});

/**
 * GET /api/v1/violations/my
 */
export const getMyViolations = asyncHandler(async (req, res) => {
  const violations = await Violation.find({ user_id: req.user._id })
    .populate({ path: 'building_id', select: 'name' })
    .populate({ path: 'room_id', select: 'roomCode' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: violations });
});

/**
 * POST /api/v1/violations
 * Progressive 3-level violations: 1_reminder -> 2_warning -> 3_fine.
 */
export const issueViolation = asyncHandler(async (req, res) => {
  const { contract_id, level, title, description, fineAmount = 0 } = req.body;
  if (!isValidObjectId(contract_id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);
  if (!['1_reminder', '2_warning', '3_fine'].includes(level)) {
    throw new AppError('Mức vi phạm phải là 1_reminder, 2_warning hoặc 3_fine', 400);
  }
  if (!title || !String(title).trim()) throw new AppError('Tiêu đề vi phạm không được để trống', 400);

  const contract = await Contract.findOne({
    _id: contract_id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    status: { $in: ['active', 'checkout_requested'] },
  }).lean();
  if (!contract) throw new AppError('Không tìm thấy hợp đồng hiệu lực trong tòa nhà', 404);

  const fine = level === '3_fine' ? Number(fineAmount) || 0 : 0;

  const violation = await Violation.create({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    room_id: contract.room_id,
    contract_id: contract._id,
    user_id: contract.user_id,
    level,
    title: String(title).trim(),
    description: String(description || title).trim(),
    fineAmount: toDecimal128(fine),
    issuedBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Đã ghi nhận biên bản vi phạm nội quy',
    data: violation,
  });
});

/**
 * PATCH /api/v1/violations/:id/status
 */
export const updateViolationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã vi phạm không hợp lệ', 400);
  if (!['active', 'resolved', 'appealed'].includes(status)) {
    throw new AppError('Trạng thái không hợp lệ', 400);
  }

  const violation = await Violation.findOneAndUpdate(
    { _id: id, tenantId: req.user.tenantId, building_id: req.buildingId },
    { $set: { status } },
    { new: true }
  );
  if (!violation) throw new AppError('Không tìm thấy biên bản vi phạm', 404);

  res.status(200).json({
    success: true,
    message: 'Cập nhật trạng thái vi phạm thành công',
    data: violation,
  });
});
