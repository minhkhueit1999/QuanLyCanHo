import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const paymentSchema = new mongoose.Schema(
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
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    deposit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deposit',
      default: null,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    referenceNote: {
      type: String,
      default: '',
      trim: true,
    },
    method: {
      type: String,
      enum: ['qr_transfer', 'cash'],
      required: true,
    },
    expectedAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    discrepancyType: {
      type: String,
      enum: ['exact', 'underpaid', 'overpaid', 'wrong_code'],
      default: 'exact',
    },
    overpaidCredit: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cashRemitStatus: {
      type: String,
      enum: ['not_applicable', 'held_by_manager', 'remitted', 'overdue_remit'],
      default: 'not_applicable',
    },
    remitDueAt: { type: Date, default: null },
    remittedAt: { type: Date, default: null },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected'],
      default: 'pending',
      required: true,
    },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

paymentSchema.index({ tenantId: 1, building_id: 1, status: 1 });
paymentSchema.index({ collectedBy: 1, cashRemitStatus: 1, remitDueAt: 1 });
applyDecimalTransform(paymentSchema);

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
