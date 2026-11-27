import AuditLog from '../models/AuditLog.js';
import { sessionOpts } from '../config/db.js';
import { serializeDecimals } from '../utils/decimal.js';

/**
 * Record an immutable audit log entry for sensitive operations.
 */
export async function recordAuditLog({
  req,
  tenantId,
  buildingId = null,
  action,
  targetModel,
  targetId = null,
  reason = '',
  beforeState = null,
  afterState = null,
  session = null,
}) {
  const actor = req?.user;
  if (!actor) return null;

  const doc = new AuditLog({
    tenantId: tenantId || actor.tenantId,
    building_id: buildingId,
    actorId: actor._id,
    actorName: actor.fullName,
    actorRole: actor.role,
    actorSubRole: actor.subRole || null,
    action,
    targetModel,
    targetId,
    reason,
    beforeState: serializeDecimals(beforeState),
    afterState: serializeDecimals(afterState),
    ipAddress: req?.ip || '',
  });

  await doc.save(sessionOpts(session));
  return doc;
}
