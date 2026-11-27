import mongoose from 'mongoose';
import { applyDecimalTransform, toDecimal128 } from '../utils/decimal.js';

const serviceTicketSchema = new mongoose.Schema(
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
      default: null,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ticketType: {
      type: String,
      enum: ['add_on_service', 'maintenance_infra', 'maintenance_resident_fault'],
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề phiếu dịch vụ/bảo trì không được để trống'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Mô tả chi tiết không được để trống'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
    },
    quotedPrice: {
      type: mongoose.Schema.Types.Decimal128,
      default: () => toDecimal128(0),
    },
    quoteConfirmedByUser: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'quoted', 'in_progress', 'completed', 'verified', 'cancelled'],
      default: 'open',
      required: true,
    },
    billing_month: {
      type: String,
      default: '',
      trim: true,
    },
    billedInInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    rating: { type: Number, min: 1, max: 5, default: null },
    reviewComment: { type: String, default: '', trim: true },
    incidentReportDueAt: { type: Date, default: null },
    incidentExplanation: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

serviceTicketSchema.index({ tenantId: 1, building_id: 1, status: 1 });
serviceTicketSchema.index({ user_id: 1, createdAt: -1 });
applyDecimalTransform(serviceTicketSchema);

const ServiceTicket = mongoose.model('ServiceTicket', serviceTicketSchema, 'service_tickets');
export default ServiceTicket;
