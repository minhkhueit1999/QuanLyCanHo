import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
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
      default: null,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    actorSubRole: { type: String, default: null },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    targetModel: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reason: { type: String, default: '', trim: true },
    beforeState: { type: mongoose.Schema.Types.Mixed, default: null },
    afterState: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, building_id: 1, action: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
export default AuditLog;
