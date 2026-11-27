import ServiceTicket from '../models/ServiceTicket.js';
import Contract from '../models/Contract.js';
import Room from '../models/Room.js';
import { isValidObjectId } from '../config/db.js';
import { toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * POST /api/v1/services
 * Resident or Manager/Admin creates service request or maintenance/incident report.
 */
export const createServiceTicket = asyncHandler(async (req, res) => {
  const {
    room_id,
    contract_id,
    ticketType = 'add_on_service',
    title,
    description,
    priority = 'normal',
    quotedPrice = 0,
  } = req.body;

  if (!title || !String(title).trim()) throw new AppError('Tiêu đề phiếu không được để trống', 400);
  if (!description || !String(description).trim()) throw new AppError('Mô tả không được để trống', 400);
  if (!['add_on_service', 'maintenance_infra', 'maintenance_resident_fault'].includes(ticketType)) {
    throw new AppError('Loại phiếu dịch vụ/bảo trì không hợp lệ', 400);
  }

  let room;
  let targetContractId = contract_id || null;
  let targetUserId = req.user._id;

  if (req.user.role === 'user') {
    const activeContract = await Contract.findOne({
      user_id: req.user._id,
      status: { $in: ['active', 'checkout_requested'] },
      ...(room_id && isValidObjectId(room_id) ? { room_id } : {}),
    }).lean();

    if (!activeContract) {
      throw new AppError('Bạn cần có hợp đồng thuê đang hiệu lực để đặt dịch vụ hoặc báo sự cố', 400);
    }
    room = await Room.findOne({
      _id: activeContract.room_id,
      tenantId: activeContract.tenantId,
      building_id: activeContract.building_id,
    }).lean();
    targetContractId = activeContract._id;
  } else {
    if (!isValidObjectId(room_id)) throw new AppError('Mã phòng không hợp lệ', 400);
    room = await Room.findOne({
      _id: room_id,
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
    }).lean();
    if (!room) throw new AppError('Không tìm thấy phòng trong tòa nhà', 404);

    const activeContract = await Contract.findOne({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      room_id: room._id,
      status: { $in: ['active', 'checkout_requested'] },
    }).lean();
    if (activeContract) {
      targetContractId = activeContract._id;
      targetUserId = activeContract.user_id;
    }
  }

  const isUrgent = priority === 'urgent';
  const ticket = await ServiceTicket.create({
    tenantId: room.tenantId,
    building_id: room.building_id,
    room_id: room._id,
    contract_id: targetContractId,
    user_id: targetUserId,
    ticketType,
    title: String(title).trim(),
    description: String(description).trim(),
    priority: isUrgent ? 'urgent' : 'normal',
    quotedPrice: toDecimal128(quotedPrice || 0),
    status: Number(quotedPrice) > 0 ? 'quoted' : 'open',
    incidentReportDueAt: isUrgent ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
  });

  res.status(201).json({
    success: true,
    message: isUrgent
      ? 'Đã tiếp nhận sự cố khẩn cấp (cần xử lý & giải trình trong 24 giờ)'
      : 'Đã tạo phiếu yêu cầu dịch vụ/bảo trì',
    data: ticket,
  });
});

/**
 * GET /api/v1/services/building
 */
export const getBuildingTickets = asyncHandler(async (req, res) => {
  const tickets = await ServiceTicket.find({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  })
    .populate({
      path: 'room_id',
      match: { tenantId: req.user.tenantId, building_id: req.buildingId },
      select: 'roomCode floor',
    })
    .populate({ path: 'user_id', select: 'fullName phone' })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: tickets });
});

/**
 * GET /api/v1/services/my
 */
export const getMyTickets = asyncHandler(async (req, res) => {
  const tickets = await ServiceTicket.find({ user_id: req.user._id })
    .populate({ path: 'building_id', select: 'name address' })
    .populate({ path: 'room_id', select: 'roomCode floor' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: tickets });
});

/**
 * PATCH /api/v1/services/:id/process
 * Manager/Admin quotes price, assigns technician, or marks completed (+ urgent explanation).
 */
export const processTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu không hợp lệ', 400);

  const ticket = await ServiceTicket.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!ticket) throw new AppError('Không tìm thấy phiếu dịch vụ/bảo trì', 404);

  const { status, quotedPrice, assignedTo, incidentExplanation, billing_month } = req.body;

  if (quotedPrice !== undefined) {
    ticket.quotedPrice = toDecimal128(quotedPrice);
    if (!status && Number(quotedPrice) > 0 && ticket.status === 'open') {
      ticket.status = 'quoted';
    }
  }
  if (assignedTo !== undefined) ticket.assignedTo = String(assignedTo).trim();
  if (incidentExplanation !== undefined) {
    ticket.incidentExplanation = String(incidentExplanation).trim();
  }
  if (billing_month !== undefined) ticket.billing_month = String(billing_month).trim();
  if (status && ['open', 'quoted', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    ticket.status = status;
  }

  await ticket.save();

  res.status(200).json({
    success: true,
    message: 'Cập nhật xử lý phiếu dịch vụ/bảo trì thành công',
    data: ticket,
  });
});

/**
 * PATCH /api/v1/services/:id/confirm-quote
 * Resident confirms quoted fee before execution.
 */
export const confirmTicketQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu không hợp lệ', 400);

  const ticket = await ServiceTicket.findOne({ _id: id, user_id: req.user._id });
  if (!ticket) throw new AppError('Không tìm thấy phiếu của bạn', 404);

  ticket.quoteConfirmedByUser = true;
  if (ticket.status === 'quoted') ticket.status = 'in_progress';
  await ticket.save();

  res.status(200).json({
    success: true,
    message: 'Đã xác nhận báo giá dịch vụ',
    data: ticket,
  });
});

/**
 * PATCH /api/v1/services/:id/rate
 * Resident verifies completion and submits 1-5 star rating & review.
 */
export const rateTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, reviewComment = '' } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã phiếu không hợp lệ', 400);

  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new AppError('Đánh giá phải từ 1 đến 5 sao', 400);
  }

  const ticket = await ServiceTicket.findOne({ _id: id, user_id: req.user._id });
  if (!ticket) throw new AppError('Không tìm thấy phiếu của bạn', 404);

  ticket.rating = stars;
  ticket.reviewComment = String(reviewComment || '').trim();
  ticket.status = 'verified';
  await ticket.save();

  res.status(200).json({
    success: true,
    message: 'Cảm ơn bạn đã nghiệm thu và đánh giá chất lượng dịch vụ',
    data: ticket,
  });
});
