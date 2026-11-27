import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const occupantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    idCard: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

const vehicleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['motorbike', 'car'], default: 'motorbike' },
    plateNumber: { type: String, required: true, trim: true, uppercase: true },
  },
  { _id: true }
);

const contractSchema = new mongoose.Schema(
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
    deposit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deposit',
      default: null,
    },
    contractCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    occupants: [occupantSchema],
    vehicles: [vehicleSchema],
    monthlyRent: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    discountAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    discountApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    depositAmount: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    pricingSnapshot: {
      electricityPrice: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(3500) },
      waterPrice: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(20000) },
      managementFee: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(150000) },
      parkingFeeMotorbike: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(120000) },
      parkingFeeCar: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(1200000) },
      lateFeeDailyRate: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(50000) },
    },
    commissionRateSnapshot: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(5),
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    signedAt: { type: Date, default: null },
    signatureText: { type: String, default: '', trim: true },
    signedDocumentUrl: { type: String, default: '', trim: true },
    handover: {
      elecInitial: { type: Number, default: 0, min: 0 },
      waterInitial: { type: Number, default: 0, min: 0 },
      keysGiven: { type: Number, default: 2, min: 0 },
      cardsGiven: { type: Number, default: 2, min: 0 },
      assetsSnapshot: [
        {
          name: String,
          quantity: Number,
          condition: String,
        },
      ],
      handedOverAt: { type: Date, default: null },
      note: { type: String, default: '' },
    },
    checkoutNoticeDate: { type: Date, default: null },
    desiredCheckoutDate: { type: Date, default: null },
    renewalReminderSentAt: { type: Date, default: null },
    settlement: {
      finalElecOld: { type: Number, default: 0 },
      finalElecNew: { type: Number, default: 0 },
      finalWaterOld: { type: Number, default: 0 },
      finalWaterNew: { type: Number, default: 0 },
      finalUtilityAndFee: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
      unpaidDebt: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
      damageCompensation: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
      netRefund: { type: mongoose.Schema.Types.Decimal128, default: () => toDecimal128(0) },
      settledAt: { type: Date, default: null },
      settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      note: { type: String, default: '' },
    },
    transferredFromContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'checkout_requested', 'terminated', 'transferred'],
      default: 'draft',
      required: true,
    },
  },
  { timestamps: true }
);

contractSchema.index({ building_id: 1, status: 1, endDate: 1 });
contractSchema.index({ tenantId: 1, building_id: 1, status: 1 });
contractSchema.index({ user_id: 1, status: 1 });
applyDecimalTransform(contractSchema);

const Contract = mongoose.model('Contract', contractSchema);
export default Contract;
