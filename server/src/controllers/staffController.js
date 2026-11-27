import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Building from '../models/Building.js';
import { isValidObjectId } from '../config/db.js';
import { toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

async function validateOwnedBuildings(buildingIds, tenantId) {
  if (!Array.isArray(buildingIds)) {
    throw new AppError('assignedBuildings phải là danh sách mảng', 400);
  }
  const uniqueIds = [...new Set(buildingIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  for (const id of uniqueIds) {
    if (!isValidObjectId(id)) throw new AppError(`Mã tòa nhà không hợp lệ: ${id}`, 400);
  }

  const owned = await Building.find({ _id: { $in: uniqueIds }, tenantId })
    .select('_id')
    .lean();

  if (owned.length !== uniqueIds.length) {
    throw new AppError('Danh sách tòa nhà phân công chứa tòa nhà ngoài phạm vi sở hữu', 403);
  }

  return owned.map((b) => b._id);
}

/**
 * GET /api/v1/staff
 * Admin only. Lists managers and sub-admins belonging to req.user.tenantId.
 */
export const getStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({
    tenantId: req.user.tenantId,
    role: { $in: ['manager', 'admin'] },
    _id: { $ne: req.user._id },
  })
    .select('-password')
    .populate({
      path: 'assignedBuildings',
      match: { tenantId: req.user.tenantId },
      select: 'name address province_name',
    })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: staff,
  });
});

/**
 * POST /api/v1/staff
 * Super-Admin creates a Manager or a Sub-Admin (operations / accountant / customer_care).
 */
export const createStaff = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    phone = '',
    password,
    role = 'manager',
    subRole = null,
    assignedBuildings = [],
    cashLimit = 50000000,
    commissionRateOverride = null,
  } = req.body;

  if (!fullName || !String(fullName).trim()) throw new AppError('Vui lòng nhập họ tên', 400);
  if (!email || !String(email).trim()) throw new AppError('Vui lòng nhập email', 400);
  if (!password || String(password).length < 6) {
    throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  if (!['manager', 'admin'].includes(role)) {
    throw new AppError('Vai trò nhân sự phải là manager hoặc admin', 400);
  }

  if (role === 'admin' && req.user.subRole && req.user.subRole !== 'super_admin') {
    throw new AppError('Chỉ Super Admin mới có quyền tạo thêm tài khoản Sub-Admin', 403);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail }).lean();
  if (exists) throw new AppError('Email này đã được sử dụng', 409);

  const validBuildings =
    role === 'manager' ? await validateOwnedBuildings(assignedBuildings, req.user.tenantId) : [];

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const created = await User.create({
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    password: hashedPassword,
    role,
    subRole:
      role === 'admin' && ['operations', 'accountant', 'customer_care'].includes(subRole)
        ? subRole
        : null,
    userStatus: 'resident',
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    tenantId: req.user.tenantId,
    assignedBuildings: validBuildings,
    managerConfig: {
      cashLimit: toDecimal128(cashLimit),
      commissionRateOverride:
        commissionRateOverride !== null && commissionRateOverride !== ''
          ? toDecimal128(commissionRateOverride)
          : null,
    },
  });

  const populated = await User.findOne({ _id: created._id, tenantId: req.user.tenantId })
    .select('-password')
    .populate({
      path: 'assignedBuildings',
      match: { tenantId: req.user.tenantId },
      select: 'name address province_name',
    })
    .lean();

  res.status(201).json({
    success: true,
    message: `Đã tạo tài khoản ${role === 'admin' ? 'Sub-Admin' : 'Manager'} "${created.fullName}"`,
    data: populated,
  });
});

/**
 * PUT /api/v1/staff/:id
 */
export const updateStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã nhân sự không hợp lệ', 400);

  const member = await User.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    _id: { $ne: req.user._id },
  });

  if (!member) throw new AppError('Không tìm thấy nhân sự trong workspace', 404);

  const {
    fullName,
    phone,
    password,
    subRole,
    assignedBuildings,
    cashLimit,
    commissionRateOverride,
  } = req.body;

  if (fullName !== undefined && String(fullName).trim()) member.fullName = String(fullName).trim();
  if (phone !== undefined) member.phone = String(phone).trim();
  if (password && String(password).length >= 6) {
    member.password = await bcrypt.hash(String(password), 10);
  }
  if (member.role === 'admin' && subRole !== undefined) {
    member.subRole = ['operations', 'accountant', 'customer_care'].includes(subRole)
      ? subRole
      : member.subRole;
  }
  if (member.role === 'manager' && assignedBuildings !== undefined) {
    member.assignedBuildings = await validateOwnedBuildings(assignedBuildings, req.user.tenantId);
  }
  if (cashLimit !== undefined) {
    member.managerConfig.cashLimit = toDecimal128(cashLimit);
  }
  if (commissionRateOverride !== undefined) {
    member.managerConfig.commissionRateOverride =
      commissionRateOverride !== null && commissionRateOverride !== ''
        ? toDecimal128(commissionRateOverride)
        : null;
  }

  await member.save();

  const populated = await User.findOne({ _id: member._id, tenantId: req.user.tenantId })
    .select('-password')
    .populate({
      path: 'assignedBuildings',
      match: { tenantId: req.user.tenantId },
      select: 'name address province_name',
    })
    .lean();

  res.status(200).json({
    success: true,
    message: 'Cập nhật nhân sự thành công',
    data: populated,
  });
});

/**
 * DELETE /api/v1/staff/:id
 */
export const deleteStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã nhân sự không hợp lệ', 400);

  const deleted = await User.findOneAndDelete({
    _id: id,
    tenantId: req.user.tenantId,
    _id: { $ne: req.user._id },
  });

  if (!deleted) throw new AppError('Không tìm thấy nhân sự để xóa', 404);

  await Building.updateMany(
    { tenantId: req.user.tenantId, primaryManagerId: deleted._id },
    { $set: { primaryManagerId: null } }
  );

  res.status(200).json({
    success: true,
    message: `Đã xóa nhân sự "${deleted.fullName}"`,
  });
});
