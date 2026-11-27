import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Building from '../models/Building.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    idCard: user.idCard || '',
    role: user.role,
    subRole: user.subRole || null,
    userStatus: user.userStatus || 'guest',
    isEmailVerified: Boolean(user.isEmailVerified),
    emailVerifiedAt: user.emailVerifiedAt || null,
    tenantId: user.tenantId,
    assignedBuildings: user.assignedBuildings || [],
    managerConfig: user.managerConfig || null,
    createdAt: user.createdAt,
  };
}

async function fetchAccessibleBuildings(user) {
  if (user.role === 'user') return [];
  const filter = { tenantId: user.tenantId };
  if (user.role === 'manager') {
    filter.$or = [
      { _id: { $in: user.assignedBuildings || [] } },
      { primaryManagerId: user._id },
      { backupManagerIds: user._id },
    ];
  }
  return Building.find(filter).sort({ createdAt: 1 }).lean();
}

/**
 * POST /api/v1/auth/register
 * Public registration is strictly restricted to standard users (role: 'user', userStatus: 'guest').
 * Blocks any attempt to inject role, subRole, tenantId, or assignedBuildings/assigned_building_ids.
 * Activates immediately and issues a session JWT without requiring OTP or email verification.
 */
export const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    phone = '',
    idCard = '',
    role,
    subRole,
    tenantId,
    assignedBuildings,
    assigned_building_ids,
  } = req.body;

  if (
    (role !== undefined && role !== 'user') ||
    subRole !== undefined ||
    tenantId !== undefined ||
    assignedBuildings !== undefined ||
    assigned_building_ids !== undefined
  ) {
    throw new AppError(
      'Đăng ký công khai chỉ cho phép tài khoản người dùng (role: user). Không được gửi kèm role hoặc phạm vi tòa nhà.',
      403
    );
  }

  if (!fullName || !String(fullName).trim()) {
    throw new AppError('Vui lòng nhập họ và tên', 400);
  }
  if (!email || !String(email).trim()) {
    throw new AppError('Vui lòng nhập email', 400);
  }
  if (!password || String(password).length < 6) {
    throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    throw new AppError('Email này đã được đăng ký tài khoản', 409);
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);
  const now = new Date();

  const user = await User.create({
    _id: new mongoose.Types.ObjectId(),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    idCard: String(idCard).trim(),
    password: hashedPassword,
    role: 'user',
    subRole: null,
    userStatus: 'guest',
    tenantId: null,
    assignedBuildings: [],
    isEmailVerified: true,
    emailVerifiedAt: now,
  });

  const token = signToken(user);

  res.status(201).json({
    success: true,
    message: 'Đăng ký tài khoản Khách thuê thành công!',
    data: {
      token,
      user: sanitizeUser(user.toObject()),
      buildings: [],
    },
  });
});

/**
 * POST /api/v1/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Vui lòng nhập đầy đủ email và mật khẩu', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401);
  }

  const valid = await bcrypt.compare(String(password), user.password);
  if (!valid) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401);
  }

  const plainUser = user.toObject();
  const buildings = await fetchAccessibleBuildings(plainUser);
  const token = signToken(user);

  res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    data: {
      token,
      user: sanitizeUser(plainUser),
      buildings,
    },
  });
});

/**
 * GET /api/v1/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  const buildings = await fetchAccessibleBuildings(req.user);

  res.status(200).json({
    success: true,
    data: {
      user: sanitizeUser(req.user),
      buildings,
    },
  });
});
