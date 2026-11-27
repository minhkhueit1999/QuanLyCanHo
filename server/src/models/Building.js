import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const handoverRecordSchema = new mongoose.Schema(
  {
    fromManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    toManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    handedOverBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    handedOverAt: { type: Date, default: Date.now },
    activeContractsCount: { type: Number, default: 0 },
    unpaidDebtTotal: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    cashHeldByPreviousManager: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    keysSummary: { type: String, default: '' },
    openTicketsCount: { type: Number, default: 0 },
    note: { type: String, default: '' },
  },
  { _id: true }
);

const buildingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Tên tòa nhà không được để trống'],
      trim: true,
      maxlength: 160,
    },
    address: {
      type: String,
      required: [true, 'Địa chỉ tòa nhà không được để trống'],
      trim: true,
      maxlength: 255,
    },
    province_code: {
      type: String,
      required: [true, 'Vui lòng chọn Tỉnh/Thành phố (chuẩn 34 đơn vị hành chính)'],
      trim: true,
    },
    province_name: {
      type: String,
      required: true,
      trim: true,
    },
    ward_code: {
      type: String,
      required: [true, 'Vui lòng chọn Phường/Xã'],
      trim: true,
    },
    ward_name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [106.7009, 10.7769],
      },
    },
    totalFloors: {
      type: Number,
      required: true,
      min: 1,
      max: 200,
      default: 5,
    },
    primaryManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    backupManagerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    pricingConfig: {
      electricityPrice: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(3500),
      },
      waterPrice: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(20000),
      },
      managementFee: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(150000),
      },
      parkingFeeMotorbike: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(120000),
      },
      parkingFeeCar: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(1200000),
      },
      lateFeeDailyRate: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(50000),
      },
    },
    commissionConfig: {
      defaultCommissionRate: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(5),
      },
      managerCashLimit: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(50000000),
      },
      cashRemitDeadlineHours: {
        type: Number,
        default: 24,
        min: 1,
      },
    },
    managerHandoverHistory: [handoverRecordSchema],
  },
  { timestamps: true }
);

buildingSchema.index({ location: '2dsphere' });
buildingSchema.index({ tenantId: 1, province_code: 1, ward_code: 1 });
buildingSchema.index({ tenantId: 1, name: 1 });
applyDecimalTransform(buildingSchema);

const Building = mongoose.model('Building', buildingSchema);
export default Building;
