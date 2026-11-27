import Building from '../models/Building.js';
import AdminDivision from '../models/AdminDivision.js';
import Room from '../models/Room.js';
import Contract from '../models/Contract.js';
import Invoice from '../models/Invoice.js';
import Deposit from '../models/Deposit.js';
import ViewBooking from '../models/ViewBooking.js';
import Payment from '../models/Payment.js';
import Commission from '../models/Commission.js';
import ServiceTicket from '../models/ServiceTicket.js';
import Violation from '../models/Violation.js';
import User from '../models/User.js';
import { isValidObjectId } from '../config/db.js';
import { toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { handoverBuildingManagerTransaction } from '../services/transactionServices.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';

/**
 * GET /api/v1/buildings
 * Admin sees all buildings in tenantId; Manager sees assigned buildings.
 */
export const getBuildings = asyncHandler(async (req, res) => {
  const filter = { tenantId: req.user.tenantId };
  if (req.user.role === 'manager') {
    filter.$or = [
      { _id: { $in: req.user.assignedBuildings || [] } },
      { primaryManagerId: req.user._id },
      { backupManagerIds: req.user._id },
    ];
  }

  const buildings = await Building.find(filter)
    .populate({
      path: 'primaryManagerId',
      match: { tenantId: req.user.tenantId },
      select: 'fullName email phone',
    })
    .sort({ createdAt: 1 })
    .lean();

  res.status(200).json({
    success: true,
    data: buildings,
  });
});

/**
 * POST /api/v1/buildings
 * Admin only. Creates a new building bound to 34-province code & ward + GeoJSON coordinates.
 */
export const createBuilding = asyncHandler(async (req, res) => {
  const {
    name,
    address,
    province_code,
    ward_code,
    coordinates,
    totalFloors = 5,
    primaryManagerId = null,
    pricingConfig = {},
    commissionConfig = {},
  } = req.body;

  if (!name || !String(name).trim()) throw new AppError('Tên tòa nhà không được để trống', 400);
  if (!address || !String(address).trim()) throw new AppError('Địa chỉ không được để trống', 400);
  if (!province_code || !ward_code) {
    throw new AppError('Vui lòng chọn Tỉnh/Thành phố và Phường/Xã (chuẩn 34 đơn vị)', 400);
  }

  const division = await AdminDivision.findOne({ admin_code: String(province_code) }).lean();
  if (!division) {
    throw new AppError('Mã Tỉnh/Thành phố không hợp lệ', 400);
  }
  const ward = (division.wards || []).find((w) => w.ward_code === String(ward_code));
  const wardName = ward ? ward.name : String(req.body.ward_name || ward_code);

  let validPrimaryManager = null;
  if (primaryManagerId) {
    if (!isValidObjectId(primaryManagerId)) throw new AppError('Mã Manager chính không hợp lệ', 400);
    const mgr = await User.findOne({
      _id: primaryManagerId,
      tenantId: req.user.tenantId,
      role: 'manager',
    }).lean();
    if (!mgr) throw new AppError('Không tìm thấy tài khoản Manager trong phạm vi công ty', 404);
    validPrimaryManager = mgr._id;
  }

  const coords =
    Array.isArray(coordinates) && coordinates.length === 2
      ? [Number(coordinates[0]), Number(coordinates[1])]
      : division.center?.coordinates || [106.7009, 10.7769];

  const building = await Building.create({
    tenantId: req.user.tenantId,
    name: String(name).trim(),
    address: String(address).trim(),
    province_code: division.admin_code,
    province_name: division.name,
    ward_code: String(ward_code),
    ward_name: wardName,
    location: { type: 'Point', coordinates: coords },
    totalFloors: Math.max(1, Number(totalFloors) || 5),
    primaryManagerId: validPrimaryManager,
    pricingConfig: {
      electricityPrice: toDecimal128(pricingConfig.electricityPrice ?? 3500),
      waterPrice: toDecimal128(pricingConfig.waterPrice ?? 20000),
      managementFee: toDecimal128(pricingConfig.managementFee ?? 150000),
      parkingFeeMotorbike: toDecimal128(pricingConfig.parkingFeeMotorbike ?? 120000),
      parkingFeeCar: toDecimal128(pricingConfig.parkingFeeCar ?? 1200000),
      lateFeeDailyRate: toDecimal128(pricingConfig.lateFeeDailyRate ?? 50000),
    },
    commissionConfig: {
      defaultCommissionRate: toDecimal128(commissionConfig.defaultCommissionRate ?? 5),
      managerCashLimit: toDecimal128(commissionConfig.managerCashLimit ?? 50000000),
      cashRemitDeadlineHours: Number(commissionConfig.cashRemitDeadlineHours) || 24,
    },
  });

  if (validPrimaryManager) {
    await User.updateOne(
      { _id: validPrimaryManager, tenantId: req.user.tenantId },
      { $addToSet: { assignedBuildings: building._id } }
    );
  }

  await recordAuditLog({
    req,
    tenantId: req.user.tenantId,
    buildingId: building._id,
    action: 'CREATE_BUILDING',
    targetModel: 'Building',
    targetId: building._id,
    afterState: { name: building.name, province_code: building.province_code },
  });

  res.status(201).json({
    success: true,
    message: `Đã khởi tạo tòa nhà "${building.name}"`,
    data: building,
  });
});

/**
 * PUT /api/v1/buildings/:id
 * Admin only.
 */
export const updateBuilding = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã tòa nhà không hợp lệ', 400);

  const building = await Building.findOne({ _id: id, tenantId: req.user.tenantId });
  if (!building) throw new AppError('Không tìm thấy tòa nhà', 404);

  const {
    name,
    address,
    province_code,
    ward_code,
    coordinates,
    totalFloors,
    pricingConfig,
    commissionConfig,
  } = req.body;

  if (name !== undefined && String(name).trim()) building.name = String(name).trim();
  if (address !== undefined && String(address).trim()) building.address = String(address).trim();
  if (totalFloors !== undefined) building.totalFloors = Math.max(1, Number(totalFloors) || 1);

  if (province_code) {
    const division = await AdminDivision.findOne({ admin_code: String(province_code) }).lean();
    if (!division) throw new AppError('Mã Tỉnh/Thành phố không hợp lệ', 400);
    building.province_code = division.admin_code;
    building.province_name = division.name;
    if (ward_code) {
      const ward = (division.wards || []).find((w) => w.ward_code === String(ward_code));
      building.ward_code = String(ward_code);
      building.ward_name = ward ? ward.name : String(req.body.ward_name || ward_code);
    }
  }

  if (Array.isArray(coordinates) && coordinates.length === 2) {
    building.location = {
      type: 'Point',
      coordinates: [Number(coordinates[0]), Number(coordinates[1])],
    };
  }

  if (pricingConfig) {
    if (pricingConfig.electricityPrice !== undefined)
      building.pricingConfig.electricityPrice = toDecimal128(pricingConfig.electricityPrice);
    if (pricingConfig.waterPrice !== undefined)
      building.pricingConfig.waterPrice = toDecimal128(pricingConfig.waterPrice);
    if (pricingConfig.managementFee !== undefined)
      building.pricingConfig.managementFee = toDecimal128(pricingConfig.managementFee);
    if (pricingConfig.parkingFeeMotorbike !== undefined)
      building.pricingConfig.parkingFeeMotorbike = toDecimal128(pricingConfig.parkingFeeMotorbike);
    if (pricingConfig.parkingFeeCar !== undefined)
      building.pricingConfig.parkingFeeCar = toDecimal128(pricingConfig.parkingFeeCar);
    if (pricingConfig.lateFeeDailyRate !== undefined)
      building.pricingConfig.lateFeeDailyRate = toDecimal128(pricingConfig.lateFeeDailyRate);
  }

  if (commissionConfig) {
    if (commissionConfig.defaultCommissionRate !== undefined)
      building.commissionConfig.defaultCommissionRate = toDecimal128(commissionConfig.defaultCommissionRate);
    if (commissionConfig.managerCashLimit !== undefined)
      building.commissionConfig.managerCashLimit = toDecimal128(commissionConfig.managerCashLimit);
    if (commissionConfig.cashRemitDeadlineHours !== undefined)
      building.commissionConfig.cashRemitDeadlineHours = Number(commissionConfig.cashRemitDeadlineHours) || 24;
  }

  await building.save();

  res.status(200).json({
    success: true,
    message: 'Cập nhật cấu hình tòa nhà thành công',
    data: building,
  });
});

/**
 * POST /api/v1/buildings/:id/handover-manager
 * Admin assigns/changes Primary Manager and generates electronic handover report.
 */
export const handoverManager = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newManagerId, note } = req.body;

  if (!isValidObjectId(id) || !isValidObjectId(newManagerId)) {
    throw new AppError('Mã tòa nhà hoặc mã Manager không hợp lệ', 400);
  }

  const building = await handoverBuildingManagerTransaction({
    req,
    tenantId: req.user.tenantId,
    buildingId: id,
    newManagerId,
    note,
  });

  res.status(200).json({
    success: true,
    message: 'Đã chuyển giao Manager chính và lập biên bản bàn giao điện tử',
    data: building,
  });
});

/**
 * DELETE /api/v1/buildings/:id
 * Admin only. Cascade deletes building data scoped strictly by tenantId + building_id.
 */
export const deleteBuilding = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã tòa nhà không hợp lệ', 400);

  const building = await Building.findOne({ _id: id, tenantId: req.user.tenantId });
  if (!building) throw new AppError('Không tìm thấy tòa nhà', 404);

  const bId = building._id;
  const tId = req.user.tenantId;

  await Promise.all([
    Commission.deleteMany({ tenantId: tId, building_id: bId }),
    Payment.deleteMany({ tenantId: tId, building_id: bId }),
    Invoice.deleteMany({ tenantId: tId, building_id: bId }),
    Contract.deleteMany({ tenantId: tId, building_id: bId }),
    Deposit.deleteMany({ tenantId: tId, building_id: bId }),
    ViewBooking.deleteMany({ tenantId: tId, building_id: bId }),
    ServiceTicket.deleteMany({ tenantId: tId, building_id: bId }),
    Violation.deleteMany({ tenantId: tId, building_id: bId }),
    Room.deleteMany({ tenantId: tId, building_id: bId }),
    User.updateMany({ tenantId: tId }, { $pull: { assignedBuildings: bId } }),
    Building.deleteOne({ _id: bId, tenantId: tId }),
  ]);

  await recordAuditLog({
    req,
    tenantId: tId,
    buildingId: bId,
    action: 'DELETE_BUILDING',
    targetModel: 'Building',
    targetId: bId,
    beforeState: { name: building.name },
  });

  res.status(200).json({
    success: true,
    message: `Đã xóa tòa nhà "${building.name}" và toàn bộ dữ liệu liên quan`,
  });
});
