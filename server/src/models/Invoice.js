import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const invoiceSchema = new mongoose.Schema(
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
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invoiceCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    billing_month: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Định dạng tháng phải là YYYY-MM'],
    },
    dueDate: {
      type: Date,
      required: true,
    },
    elecOld: { type: Number, required: true, min: 0 },
    elecNew: { type: Number, required: true, min: 0 },
    elecPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
    elecProofUrl: { type: String, default: '', trim: true },

    waterOld: { type: Number, required: true, min: 0 },
    waterNew: { type: Number, required: true, min: 0 },
    waterPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
    waterProofUrl: { type: String, default: '', trim: true },

    roomFee: { type: mongoose.Schema.Types.Decimal128, required: true },
    managementFee: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    parkingFee: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    serviceFee: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    previousDebt: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    discountAmount: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    lateFee: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    lateFeeWaived: { type: Boolean, default: false },
    totalAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    paidAmount: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
    remainingAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue', 'cancelled'],
      default: 'unpaid',
      required: true,
    },
    remindersSent: {
      before3Days: { type: Boolean, default: false },
      onDueDate: { type: Boolean, default: false },
      overdue: { type: Boolean, default: false },
    },
    serviceTicketIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceTicket' }],
    note: { type: String, default: '', trim: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ building_id: 1, billing_month: 1, status: 1 });
invoiceSchema.index(
  { contract_id: 1, billing_month: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['unpaid', 'partial', 'paid', 'overdue'] } },
  }
);
invoiceSchema.index({ user_id: 1, billing_month: -1 });
applyDecimalTransform(invoiceSchema);

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
