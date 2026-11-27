import Contract from '../models/Contract.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import { isValidObjectId, runInTransaction, sessionOpts } from '../config/db.js';
import { decToNumber, roundMoney, toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import {
  activateContractTransaction,
  settleCheckoutTransaction,
} from '../services/transactionServices.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';

/**
 * GET /api/v1/contracts/building
 */
export const getBuildingContracts = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { tenantId: req.user.tenantId, building_id: req.buildingId };
  if (status && status !== 'ALL') filter.status = String(status);

  const contracts = await Contract.find(filter)
    .populate({
      path: 'room_id',
      match: { tenantId: req.user.tenantId, building_id: req.buildingId },
      select: 'roomCode floor area maxOccupants base_price',
    })
    .populate({ path: 'user_id', select: 'fullName email phone userStatus' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: contracts });
});

/**
 * GET /api/v1/contracts/my
 * Resident views their own contracts.
 */
export const getMyContracts = asyncHandler(async (req, res) => {
  const contracts = await Contract.find({ user_id: req.user._id })
    .populate({ path: 'building_id', select: 'name address province_name ward_name pricingConfig' })
    .populate({ path: 'room_id', select: 'roomCode floor area maxOccupants assets keysAndCards' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: contracts });
});

/**
 * POST /api/v1/contracts
 * Creates & activates contract + handover inside ACID transaction.
 */
export const createContract = asyncHandler(async (req, res) => {
  const {
    room_id,
    user_id,
    userEmail,
    deposit_id = null,
    occupants,
    vehicles = [],
    monthlyRent,
    discountAmount = 0,
    depositAmount = 0,
    startDate,
    endDate,
    signatureText,
    signedDocumentUrl = '',
    handover = {},
  } = req.body;

  if (!isValidObjectId(room_id)) throw new AppError('Mã phòng không hợp lệ', 400);
  if (!startDate || !endDate) throw new AppError('Vui lòng nhập ngày bắt đầu và kết thúc', 400);

  let targetUserId = user_id;
  if (!targetUserId && userEmail) {
    const foundUser = await User.findOne({ email: String(userEmail).toLowerCase().trim() }).lean();
    if (!foundUser) {
      throw new AppError(`Không tìm thấy tài khoản cư dân với email ${userEmail}`, 404);
    }
    targetUserId = foundUser._id;
  }
  if (!isValidObjectId(targetUserId)) {
    throw new AppError('Vui lòng chọn tài khoản cư dân hợp lệ', 400);
  }

  const contract = await activateContractTransaction({
    req,
    tenantId: req.user.tenantId,
    building: req.building,
    roomId: room_id,
    userId: targetUserId,
    depositId: deposit_id,
    occupants,
    vehicles,
    monthlyRent,
    discountAmount,
    depositAmount,
    startDate,
    endDate,
    signatureText,
    signedDocumentUrl,
    handover,
  });

  res.status(201).json({
    success: true,
    message: `Đã ký & kích hoạt hợp đồng ${contract.contractCode}`,
    data: contract,
  });
});

/**
 * PUT /api/v1/contracts/:id/occupants-vehicles
 * Updates occupants (respecting maxOccupants) and registered vehicles.
 */
export const updateOccupantsAndVehicles = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);

  const contract = await Contract.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!contract) throw new AppError('Không tìm thấy hợp đồng', 404);

  const room = await Room.findOne({
    _id: contract.room_id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  }).lean();

  const { occupants, vehicles } = req.body;
  if (Array.isArray(occupants)) {
    if (occupants.length === 0) throw new AppError('Phải có ít nhất 1 nhân khẩu', 400);
    if (room && occupants.length > room.maxOccupants) {
      throw new AppError(`Số nhân khẩu vượt quá mức tối đa (${room.maxOccupants} người)`, 400);
    }
    contract.occupants = occupants;
  }
  if (Array.isArray(vehicles)) {
    contract.vehicles = vehicles;
  }

  await contract.save();
  res.status(200).json({
    success: true,
    message: 'Đã cập nhật nhân khẩu & phương tiện trên hợp đồng',
    data: contract,
  });
});

/**
 * POST /api/v1/contracts/:id/change-room
 * Switches active contract to a new available room with proration calculation.
 */
export const changeContractRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newRoomId, changeDate = new Date(), note = '' } = req.body;

  if (!isValidObjectId(id) || !isValidObjectId(newRoomId)) {
    throw new AppError('Mã hợp đồng hoặc mã phòng mới không hợp lệ', 400);
  }

  const result = await runInTransaction(async (session) => {
    const opts = sessionOpts(session);
    const contract = await Contract.findOne(
      { _id: id, tenantId: req.user.tenantId, building_id: req.buildingId, status: 'active' },
      null,
      opts
    );
    if (!contract) throw new AppError('Không tìm thấy hợp đồng đang hiệu lực', 404);

    const newRoom = await Room.findOne(
      { _id: newRoomId, tenantId: req.user.tenantId, building_id: req.buildingId, status: 'available' },
      null,
      opts
    );
    if (!newRoom) throw new AppError('Phòng mới không tồn tại hoặc không ở trạng thái trống', 400);
    if (contract.occupants.length > newRoom.maxOccupants) {
      throw new AppError('Phòng mới không đủ sức chứa cho số nhân khẩu hiện tại', 400);
    }

    const oldRoomId = contract.room_id;
    const oldRent = decToNumber(contract.monthlyRent);
    const newRent = decToNumber(newRoom.base_price);

    const switchDay = new Date(changeDate).getDate();
    const daysInMonth = 30;
    const remainingDays = Math.max(0, daysInMonth - switchDay + 1);
    const prorationDelta = roundMoney(((newRent - oldRent) / daysInMonth) * remainingDays);

    contract.room_id = newRoom._id;
    contract.monthlyRent = toDecimal128(newRent);
    contract.handover.note = `${contract.handover.note ? contract.handover.note + ' | ' : ''}Đổi phòng ngày ${switchDay}, chênh lệch proration: ${prorationDelta}đ. ${note}`;
    await contract.save(opts);

    await Room.updateOne({ _id: oldRoomId, tenantId: req.user.tenantId }, { $set: { status: 'available' } }, opts);
    await Room.updateOne({ _id: newRoom._id, tenantId: req.user.tenantId }, { $set: { status: 'occupied' } }, opts);

    await recordAuditLog({
      req,
      tenantId: req.user.tenantId,
      buildingId: req.buildingId,
      action: 'CHANGE_ROOM',
      targetModel: 'Contract',
      targetId: contract._id,
      reason: note || 'Đổi phòng trong tòa nhà',
      beforeState: { room_id: oldRoomId, monthlyRent: oldRent },
      afterState: { room_id: newRoom._id, monthlyRent: newRent, prorationDelta },
      session,
    });

    return { contract, prorationDelta };
  });

  res.status(200).json({
    success: true,
    message: `Đã chuyển phòng thành công (Chênh lệch theo ngày thực tế: ${result.prorationDelta.toLocaleString('vi-VN')}đ)`,
    data: result,
  });
});

/**
 * POST /api/v1/contracts/:id/transfer
 * Transfers contract to a new primary user email.
 */
export const transferContract = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newUserEmail, fullName, phone, idCard, note = '' } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);
  if (!newUserEmail) throw new AppError('Vui lòng nhập email người nhận chuyển nhượng', 400);

  const newUser = await User.findOne({ email: String(newUserEmail).toLowerCase().trim() });
  if (!newUser) throw new AppError('Không tìm thấy tài khoản người nhận chuyển nhượng', 404);

  const contract = await Contract.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    status: 'active',
  });
  if (!contract) throw new AppError('Không tìm thấy hợp đồng hiệu lực', 404);

  const prevUserId = contract.user_id;
  contract.user_id = newUser._id;
  contract.occupants = [
    {
      fullName: fullName || newUser.fullName,
      phone: phone || newUser.phone || 'Chưa cập nhật',
      idCard: idCard || newUser.idCard || 'Chưa cập nhật',
      isPrimary: true,
    },
  ];
  await contract.save();

  newUser.userStatus = 'resident';
  await newUser.save();

  const prevOtherActive = await Contract.countDocuments({ user_id: prevUserId, status: 'active' });
  if (prevOtherActive === 0) {
    await User.updateOne({ _id: prevUserId }, { $set: { userStatus: 'former' } });
  }

  await recordAuditLog({
    req,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
    action: 'TRANSFER_CONTRACT',
    targetModel: 'Contract',
    targetId: contract._id,
    reason: note || 'Chuyển nhượng hợp đồng',
    beforeState: { user_id: prevUserId },
    afterState: { user_id: newUser._id },
  });

  res.status(200).json({
    success: true,
    message: 'Đã chuyển nhượng hợp đồng sang cư dân mới',
    data: contract,
  });
});

/**
 * POST /api/v1/contracts/:id/request-checkout
 * Resident or Manager logs checkout notice (minimum 30 days notice check).
 */
export const requestCheckout = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);

  const filter =
    req.user.role === 'user'
      ? { _id: id, user_id: req.user._id, status: 'active' }
      : { _id: id, tenantId: req.user.tenantId, building_id: req.buildingId, status: 'active' };

  const contract = await Contract.findOne(filter);
  if (!contract) throw new AppError('Không tìm thấy hợp đồng đang hiệu lực', 404);

  const desiredDate = req.body.desiredCheckoutDate
    ? new Date(req.body.desiredCheckoutDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const daysAhead = Math.ceil((desiredDate - new Date()) / (24 * 60 * 60 * 1000));
  if (daysAhead < 30 && !req.body.forceEarly) {
    throw new AppError('Theo quy định cần báo trả phòng trước tối thiểu 30 ngày', 400);
  }

  contract.checkoutNoticeDate = new Date();
  contract.desiredCheckoutDate = desiredDate;
  contract.status = 'checkout_requested';
  await contract.save();

  res.status(200).json({
    success: true,
    message: 'Đã ghi nhận yêu cầu báo trả phòng',
    data: contract,
  });
});

/**
 * POST /api/v1/contracts/:id/extend
 * Extends active contract endDate (renewal).
 */
export const extendContract = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newEndDate, newMonthlyRent } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);
  if (!newEndDate) throw new AppError('Vui lòng chọn ngày kết thúc mới', 400);

  const contract = await Contract.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    status: { $in: ['active', 'checkout_requested'] },
  });
  if (!contract) throw new AppError('Không tìm thấy hợp đồng hiệu lực', 404);

  const parsedEnd = new Date(newEndDate);
  if (Number.isNaN(parsedEnd.getTime()) || parsedEnd <= contract.endDate) {
    throw new AppError('Ngày gia hạn mới phải sau ngày kết thúc hiện tại', 400);
  }

  contract.endDate = parsedEnd;
  contract.status = 'active';
  if (newMonthlyRent !== undefined && Number(newMonthlyRent) > 0) {
    contract.monthlyRent = toDecimal128(newMonthlyRent);
  }
  await contract.save();

  res.status(200).json({
    success: true,
    message: `Đã gia hạn hợp đồng ${contract.contractCode}`,
    data: contract,
  });
});

/**
 * POST /api/v1/contracts/:id/settle-checkout
 * Settles deposit refund & terminates contract inside ACID transaction.
 */
export const settleCheckout = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);

  const settled = await settleCheckoutTransaction({
    req,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
    contractId: id,
    ...req.body,
  });

  res.status(200).json({
    success: true,
    message: 'Đã hoàn tất quyết toán trả phòng và chuyển phòng sang bảo trì kiểm tra',
    data: settled,
  });
});
