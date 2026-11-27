import mongoose from 'mongoose';

const viewBookingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    building_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      required: true,
      index: true,
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    visitorName: {
      type: String,
      required: [true, 'Vui lòng nhập họ tên khách xem phòng'],
      trim: true,
    },
    visitorPhone: {
      type: String,
      required: [true, 'Vui lòng nhập số điện thoại'],
      trim: true,
    },
    visitorEmail: {
      type: String,
      default: '',
      trim: true,
    },
    bookingType: {
      type: String,
      enum: ['in_person', 'video_call'],
      default: 'in_person',
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Vui lòng chọn ngày giờ xem phòng'],
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    outcome: {
      type: String,
      enum: ['pending', 'interested', 'deposited', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

viewBookingSchema.index({ tenantId: 1, building_id: 1, scheduledAt: 1 });
viewBookingSchema.index({ user_id: 1, scheduledAt: -1 });

const ViewBooking = mongoose.model('ViewBooking', viewBookingSchema, 'view_bookings');
export default ViewBooking;
