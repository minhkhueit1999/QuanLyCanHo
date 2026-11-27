import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isValidObjectId } from '../config/db.js';
import { AppError, asyncHandler } from './errorHandler.js';

/**
 * Authenticate bearer token and load live user scoped by _id (and tenantId when present).
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 401);
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new AppError('Thiếu mã xác thực (Access Token)', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Token không hợp lệ hoặc đã hết hạn', 401);
  }

  if (!isValidObjectId(decoded?.userId)) {
    throw new AppError('Dữ liệu xác thực không hợp lệ', 401);
  }

  const query = { _id: decoded.userId };
  if (decoded.tenantId) {
    if (!isValidObjectId(decoded.tenantId)) {
      throw new AppError('Dữ liệu tenant không hợp lệ', 401);
    }
    query.tenantId = decoded.tenantId;
  } else {
    query.tenantId = null;
  }

  const user = await User.findOne(query).select('-password').lean();
  if (!user) {
    throw new AppError('Tài khoản không tồn tại hoặc đã bị thu hồi quyền', 401);
  }

  req.user = user;
  next();
});

/**
 * Optional auth middleware for public exploration endpoints.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (isValidObjectId(decoded?.userId)) {
      const user = await User.findOne({ _id: decoded.userId }).select('-password').lean();
      if (user) req.user = user;
    }
  } catch {
    // Ignore invalid optional tokens on public routes
  }
  return next();
});

/**
 * Role guard supporting ['admin', 'manager', 'user'].
 * @param  {...string} roles
 */
export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Bạn không có quyền thực hiện thao tác này', 403));
    }
    return next();
  };
}

/**
 * Admin sub-role guard (super_admin always allowed).
 * @param  {...string} allowedSubRoles
 */
export function requireAdminSubRole(...allowedSubRoles) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(new AppError('Chỉ Admin mới có quyền thực hiện thao tác này', 403));
    }
    const sub = req.user.subRole || 'super_admin';
    if (sub === 'super_admin' || allowedSubRoles.includes(sub)) {
      return next();
    }
    return next(
      new AppError(
        `Phân quyền con (${sub}) không được phép thực hiện thao tác nhạy cảm này`,
        403
      )
    );
  };
}
