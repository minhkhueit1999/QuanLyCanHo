import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const assetItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    condition: { type: String, default: 'Tốt', trim: true },
    value: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
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
    roomCode: {
      type: String,
      required: [true, 'Mã phòng không được để trống'],
      trim: true,
      maxlength: 30,
    },
    floor: {
      type: Number,
      required: true,
      min: 1,
    },
    area: {
      type: Number,
      required: true,
      min: 1,
    },
    maxOccupants: {
      type: Number,
      default: 2,
      min: 1,
      max: 10,
    },
    base_price: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    defaultDeposit: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    proposedPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    discountLimit: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(500000),
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'available', 'reserved', 'occupied', 'maintenance'],
      default: 'pending_approval',
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvalNote: {
      type: String,
      default: '',
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    photoIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomPhoto' }],
    images: [{ type: String, trim: true }],
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    amenities: [{ type: String, trim: true }],
    assets: [assetItemSchema],
    keysAndCards: {
      mechanicalKeys: { type: Number, default: 2, min: 0 },
      keyCards: { type: Number, default: 2, min: 0 },
      note: { type: String, default: '' },
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

roomSchema.index({ tenantId: 1, building_id: 1, roomCode: 1 }, { unique: true });
roomSchema.index({ building_id: 1, status: 1, base_price: 1 });
roomSchema.index({ isPublished: 1, approvalStatus: 1, status: 1 });
applyDecimalTransform(roomSchema);

const Room = mongoose.model('Room', roomSchema);
export default Room;
