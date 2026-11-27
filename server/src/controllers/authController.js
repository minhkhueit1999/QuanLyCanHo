import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Building from '../models/Building.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

const VERIFY_TTL_MINUTES = Number(process.env.EMAIL_VERIFY_TTL_MINUTES) || 30;
const RESEND_COOLDOWN_MS = 60 * 1000;

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

function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function buildVerificationUrl(rawToken, email) {
  const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  return `${clientBase}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(
    email
  )}`;
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
 * Issues a SHA-256 email verification link (30 min TTL, no OTP).
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
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFY_TTL_MINUTES * 60 * 1000);

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
    isEmailVerified: false,
    emailVerifiedAt: null,
    verificationTokenHash: tokenHash,
    verificationExpiresAt: expiresAt,
    verificationLastSentAt: now,
  });

  const verificationUrl = buildVerificationUrl(rawToken, normalizedEmail);
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Email Verification] ${normalizedEmail} -> ${verificationUrl}`);
  }

  res.status(201).json({
    success: true,
    message:
      'Đăng ký thành công! Vui lòng kiểm tra email và bấm vào link kích hoạt (hiệu lực 30 phút).',
    data: {
      user: sanitizeUser(user.toObject()),
      requiresEmailVerification: true,
      expiresAt,
      cooldownSeconds: 60,
      ...(process.env.NODE_ENV !== 'production'
        ? { devVerificationUrl: verificationUrl, devVerificationToken: rawToken }
        : {}),
    },
  });
});

/**
 * GET / POST /api/v1/auth/verify-email
 * Activates user account using raw verification token matched against SHA-256 hash.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const rawToken = req.query.token || req.body?.token;
  if (!rawToken || !String(rawToken).trim()) {
    throw new AppError('Thiếu mã xác nhận email (token)', 400);
  }

  const tokenHash = hashVerificationToken(String(rawToken).trim());
  const user = await User.findOne({ verificationTokenHash: tokenHash }).select(
    '+verificationTokenHash +verificationExpiresAt'
  );

  if (!user) {
    throw new AppError('Link kích hoạt không hợp lệ hoặc đã được sử dụng', 400);
  }

  if (!user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
    throw new AppError('Link kích hoạt đã hết hạn (quá 30 phút). Vui lòng gửi lại link mới.', 400);
  }

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.verificationTokenHash = null;
  user.verificationExpiresAt = null;
  await user.save();

  const plainUser = user.toObject();
  const token = signToken(user);

  res.status(200).json({
    success: true,
    message: 'Xác nhận email thành công! Tài khoản canho.com của bạn đã được kích hoạt.',
    data: {
      token,
      user: sanitizeUser(plainUser),
      buildings: [],
    },
  });
});

/**
 * POST /api/v1/auth/resend-verification
 * Resends activation link with strict 60-second cooldown per account.
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !String(email).trim()) {
    throw new AppError('Vui lòng nhập email cần gửi lại link kích hoạt', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError('Không tìm thấy tài khoản với email này', 404);
  }
  if (user.isEmailVerified) {
    throw new AppError('Tài khoản này đã xác nhận email trước đó', 400);
  }

  const now = new Date();
  if (user.verificationLastSentAt) {
    const elapsedMs = now.getTime() - new Date(user.verificationLastSentAt).getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      return res.status(429).json({
        success: false,
        message: `Vui lòng đợi ${waitSeconds} giây trước khi gửi lại link kích hoạt`,
        retryAfterSeconds: waitSeconds,
      });
    }
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.verificationTokenHash = hashVerificationToken(rawToken);
  user.verificationExpiresAt = new Date(now.getTime() + VERIFY_TTL_MINUTES * 60 * 1000);
  user.verificationLastSentAt = now;
  await user.save();

  const verificationUrl = buildVerificationUrl(rawToken, normalizedEmail);
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Resend Verification] ${normalizedEmail} -> ${verificationUrl}`);
  }

  res.status(200).json({
    success: true,
    message: 'Đã gửi lại link kích hoạt vào email của bạn (hiệu lực 30 phút).',
    data: {
      cooldownSeconds: 60,
      ...(process.env.NODE_ENV !== 'production'
        ? { devVerificationUrl: verificationUrl, devVerificationToken: rawToken }
        : {}),
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

  if (user.role === 'user' && !user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message:
        'Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư hoặc gửi lại link kích hoạt.',
    });
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
