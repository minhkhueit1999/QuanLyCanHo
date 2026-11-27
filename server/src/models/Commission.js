import mongoose from 'mongoose';
import { applyDecimalTransform } from '../utils/decimal.js';

const commissionSchema = new mongoose.Schema(
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
    manager_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    period: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Kỳ hoa hồng phải là YYYY-MM'],
    },
    roomFeeCollected: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    commissionRate: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    commissionAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    status: {
      type: String,
      enum: ['provisional', 'pending_approval', 'approved', 'disputed', 'paid'],
      default: 'provisional',
      required: true,
    },
    disputeReason: { type: String, default: '', trim: true },
    disputeResolution: { type: String, default: '', trim: true },
    disputeDeadline: { type: Date, default: null },
    payoutDate: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commissionSchema.index({ manager_id: 1, period: 1, status: 1 });
commissionSchema.index({ tenantId: 1, building_id: 1, period: 1 });
applyDecimalTransform(commissionSchema);

const Commission = mongoose.model('Commission', commissionSchema);
export default Commission;
