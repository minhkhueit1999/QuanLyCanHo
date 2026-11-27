import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Họ và tên không được để trống'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email không được để trống'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Định dạng email không hợp lệ'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 25,
    },
    idCard: {
      type: String,
      trim: true,
      default: '',
      maxlength: 30,
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu không được để trống'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'user'],
      default: 'user',
      required: true,
    },
    subRole: {
      type: String,
      enum: ['super_admin', 'operations', 'accountant', 'customer_care', null],
      default: null,
    },
    userStatus: {
      type: String,
      enum: ['guest', 'depositor', 'resident', 'former'],
      default: 'guest',
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedBuildings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Building',
      },
    ],
    managerConfig: {
      cashLimit: {
        type: mongoose.Schema.Types.Decimal128,
        default: () => toDecimal128(50000000),
      },
      commissionRateOverride: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    verificationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    verificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    verificationLastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ role: 1, userStatus: 1 });
applyDecimalTransform(userSchema);

const User = mongoose.model('User', userSchema);
export default User;
