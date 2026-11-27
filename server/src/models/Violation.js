import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const violationSchema = new mongoose.Schema(
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
    contract_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    level: {
      type: String,
      enum: ['1_reminder', '2_warning', '3_fine'],
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Nội dung vi phạm không được để trống'],
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    fineAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'appealed'],
      default: 'active',
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

violationSchema.index({ tenantId: 1, building_id: 1, user_id: 1, createdAt: -1 });
applyDecimalTransform(violationSchema);

const Violation = mongoose.model('Violation', violationSchema);
export default Violation;
