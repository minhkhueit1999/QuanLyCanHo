/**
 * Custom operational HTTP error with status code.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wrap async route handlers to forward rejected promises to errorHandler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 fallback middleware for unmatched API routes.
 */
export function notFoundHandler(req, res, next) {
  next(new AppError(`Không tìm thấy đường dẫn API: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Centralized Express error handler.
 */
export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Đã xảy ra lỗi hệ thống';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join('; ');
  } else if (err.code === 11000) {
    statusCode = 409;
    const duplicateFields = Object.keys(err.keyPattern || {});
    if (duplicateFields.includes('email')) {
      message = 'Email này đã được sử dụng trong hệ thống';
    } else if (duplicateFields.includes('roomCode')) {
      message = 'Mã phòng này đã tồn tại trong tòa nhà';
    } else if (duplicateFields.includes('billing_month')) {
      message = 'Hóa đơn của hợp đồng trong tháng này đã tồn tại';
    } else {
      message = 'Dữ liệu bị trùng lặp';
    }
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Định dạng mã định danh không hợp lệ';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[Server Error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500
      ? { stack: err.stack }
      : {}),
  });
}
