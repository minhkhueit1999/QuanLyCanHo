import ViewBooking from '../models/ViewBooking.js';
import Room from '../models/Room.js';
import { isValidObjectId } from '../config/db.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

/**
 * POST /api/v1/bookings
 * Public / User or Manager books a room viewing (in_person or video_call).
 */
export const createViewBooking = asyncHandler(async (req, res) => {
  const {
    room_id,
    visitorName,
    visitorPhone,
    visitorEmail = '',
    bookingType = 'in_person',
    scheduledAt,
    note = '',
  } = req.body;

  if (!isValidObjectId(room_id)) throw new AppError('Mã phòng không hợp lệ', 400);
  if (!visitorName || !String(visitorName).trim()) throw new AppError('Vui lòng nhập họ tên', 400);
  if (!visitorPhone || !String(visitorPhone).trim()) throw new AppError('Vui lòng nhập SĐT', 400);
  if (!scheduledAt) throw new AppError('Vui lòng chọn thời gian xem phòng', 400);

  const schedDate = new Date(scheduledAt);
  if (Number.isNaN(schedDate.getTime())) throw new AppError('Thời gian xem phòng không hợp lệ', 400);

  const room = await Room.findOne({ _id: room_id }).lean();
  if (!room) throw new AppError('Không tìm thấy phòng', 404);

  // If staff creates booking inside workspace, enforce tenant/building match
  if (req.user && ['admin', 'manager'].includes(req.user.role)) {
    if (room.tenantId.toString() !== req.user.tenantId.toString()) {
      throw new AppError('Không có quyền đặt lịch cho tòa nhà khác', 403);
    }
  } else if (!room.isPublished || room.approvalStatus !== 'approved') {
    throw new AppError('Phòng này chưa được mở công khai để đặt lịch xem', 400);
  }

  const booking = await ViewBooking.create({
    tenantId: room.tenantId,
    building_id: room.building_id,
    room_id: room._id,
    user_id: req.user ? req.user._id : null,
    visitorName: String(visitorName).trim(),
    visitorPhone: String(visitorPhone).trim(),
    visitorEmail: String(visitorEmail).trim(),
    bookingType: ['in_person', 'video_call'].includes(bookingType) ? bookingType : 'in_person',
    scheduledAt: schedDate,
    note: String(note || '').trim(),
  });

  res.status(201).json({
    success: true,
    message: 'Đặt lịch xem phòng thành công',
    data: booking,
  });
});

/**
 * GET /api/v1/bookings/my
 * Authenticated user views their own room viewing bookings.
 */
export const getMyViewBookings = asyncHandler(async (req, res) => {
  const bookings = await ViewBooking.find({ user_id: req.user._id })
    .populate({ path: 'building_id', select: 'name address province_name ward_name' })
    .populate({ path: 'room_id', select: 'roomCode floor area base_price status' })
    .sort({ scheduledAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: bookings });
});

/**
 * GET /api/v1/bookings/building
 * Admin/Manager views bookings scoped strictly by tenantId + building_id.
 */
export const getBuildingViewBookings = asyncHandler(async (req, res) => {
  const bookings = await ViewBooking.find({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  })
    .populate({
      path: 'room_id',
      match: { tenantId: req.user.tenantId, building_id: req.buildingId },
      select: 'roomCode floor status',
    })
    .sort({ scheduledAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: bookings });
});

/**
 * PATCH /api/v1/bookings/:id/outcome
 * Admin/Manager updates viewing result: interested / deposited / rejected (+ reason).
 */
export const updateBookingOutcome = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã lịch hẹn không hợp lệ', 400);

  const { status = 'completed', outcome, rejectionReason = '' } = req.body;
  if (!['pending', 'interested', 'deposited', 'rejected'].includes(outcome)) {
    throw new AppError('Kết quả xem phòng không hợp lệ', 400);
  }
  if (outcome === 'rejected' && !String(rejectionReason).trim()) {
    throw new AppError('Vui lòng ghi rõ lý do khách từ chối để cải thiện dịch vụ', 400);
  }

  const booking = await ViewBooking.findOneAndUpdate(
    { _id: id, tenantId: req.user.tenantId, building_id: req.buildingId },
    {
      $set: {
        status: ['scheduled', 'completed', 'cancelled'].includes(status) ? status : 'completed',
        outcome,
        rejectionReason: String(rejectionReason || '').trim(),
        handledBy: req.user._id,
      },
    },
    { new: true }
  );

  if (!booking) throw new AppError('Không tìm thấy lịch xem phòng trong tòa nhà', 404);

  res.status(200).json({
    success: true,
    message: 'Đã cập nhật kết quả buổi xem phòng',
    data: booking,
  });
});
