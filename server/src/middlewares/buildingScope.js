import Building from '../models/Building.js';
import { isValidObjectId } from '../config/db.js';
import { AppError, asyncHandler } from './errorHandler.js';

/**
 * Enforce strict Tenant + Building Isolation via X-Building-Id header (or query/param fallback).
 * - Blocks access across different tenantId workspaces (403 Forbidden)
 * - For manager role, verifies building is assigned in assignedBuildings or primaryManagerId (403 Forbidden)
 */
export const buildingScopeGuard = asyncHandler(async (req, res, next) => {
  if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
    throw new AppError('Chỉ Admin hoặc Manager mới được truy cập vùng dữ liệu tòa nhà', 403);
  }

  const buildingId = req.headers['x-building-id'] || req.query.building_id;
  if (!buildingId || !isValidObjectId(buildingId)) {
    throw new AppError('Thiếu hoặc sai định dạng mã tòa nhà (X-Building-Id)', 400);
  }

  const building = await Building.findOne({
    _id: buildingId,
    tenantId: req.user.tenantId,
  }).lean();

  if (!building) {
    throw new AppError('Không tìm thấy tòa nhà hoặc bạn không có quyền truy cập', 403);
  }

  if (req.user.role === 'manager') {
    const isAssigned =
      (req.user.assignedBuildings || []).some(
        (bId) => bId.toString() === building._id.toString()
      ) ||
      (building.primaryManagerId &&
        building.primaryManagerId.toString() === req.user._id.toString()) ||
      (building.backupManagerIds || []).some(
        (bId) => bId.toString() === req.user._id.toString()
      );

    if (!isAssigned) {
      throw new AppError('Bạn không được phân công quản lý tòa nhà này', 403);
    }
  }

  req.buildingId = building._id;
  req.building = building;
  next();
});
