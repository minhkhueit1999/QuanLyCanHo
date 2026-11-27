import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const depositSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    depositCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['qr_transfer', 'cash'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'payment_verifying',
        'held',
        'converted_to_contract',
        'refund_pending',
        'refunded',
        'forfeited',
        'expired',
        'cancelled',
      ],
      default: 'pending_payment',
      required: true,
    },
    hold_expires_at: {
      type: Date,
      required: true,
    },
    paymentProofUrl: {
      type: String,
      default: '',
      trim: true,
    },
    refundAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    refundReason: {
      type: String,
      default: '',
      trim: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

depositSchema.index({ status: 1, hold_expires_at: 1 });
depositSchema.index({ tenantId: 1, building_id: 1, status: 1 });
depositSchema.index({ user_id: 1, createdAt: -1 });
applyDecimalTransform(depositSchema);

const Deposit = mongoose.model('Deposit', depositSchema);
export default Deposit;
