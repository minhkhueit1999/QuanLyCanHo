import mongoose from 'mongoose';
import Building from '../models/Building.js';
import Room from '../models/Room.js';
import Contract from '../models/Contract.js';
import Invoice from '../models/Invoice.js';
import Deposit from '../models/Deposit.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import { decToNumber, roundMoney } from '../utils/decimal.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { runScheduledJobs } from '../services/schedulerService.js';

function getLastNMonths(n = 6) {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    result.push({
      month: `${yyyy}-${mm}`,
      label: `T${Number(mm)}/${String(yyyy).slice(2)}`,
    });
  }
  return result;
}

/**
 * GET /api/v1/dashboard/building
 * Protected by buildingScopeGuard.
 */
export const getBuildingDashboard = asyncHandler(async (req, res) => {
  const tenantObjId = new mongoose.Types.ObjectId(req.user.tenantId);
  const buildingObjId = new mongoose.Types.ObjectId(req.buildingId);

  const months = getLastNMonths(6);
  const currentMonth = months[months.length - 1].month;
  const monthKeys = months.map((m) => m.month);

  const now = new Date();
  const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

  const [
    rooms,
    invoices,
    expiringContracts,
    pendingDeposits,
    overdueManagerCash,
  ] = await Promise.all([
    Room.find({ tenantId: tenantObjId, building_id: buildingObjId }).select('status approvalStatus').lean(),
    Invoice.find({
      tenantId: tenantObjId,
      building_id: buildingObjId,
      status: { $ne: 'cancelled' },
    }).lean(),
    Contract.find({
      tenantId: tenantObjId,
      building_id: buildingObjId,
      status: { $in: ['active', 'checkout_requested'] },
      endDate: { $lte: in45Days },
    })
      .populate({
        path: 'room_id',
        match: { tenantId: tenantObjId, building_id: buildingObjId },
        select: 'roomCode floor',
      })
      .populate({ path: 'user_id', select: 'fullName phone' })
      .sort({ endDate: 1 })
      .lean(),
    Deposit.countDocuments({
      tenantId: tenantObjId,
      building_id: buildingObjId,
      status: { $in: ['pending_payment', 'payment_verifying', 'held'] },
    }),
    Payment.countDocuments({
      tenantId: tenantObjId,
      building_id: buildingObjId,
      cashRemitStatus: 'overdue_remit',
    }),
  ]);

  let availableCount = 0;
  let occupiedCount = 0;
  let reservedCount = 0;
  let maintenanceCount = 0;
  let pendingApprovalCount = 0;

  for (const r of rooms) {
    if (r.approvalStatus === 'pending' || r.status === 'pending_approval') {
      pendingApprovalCount += 1;
    }
    if (r.status === 'available') availableCount += 1;
    else if (r.status === 'occupied') occupiedCount += 1;
    else if (r.status === 'reserved') reservedCount += 1;
    else if (r.status === 'maintenance') maintenanceCount += 1;
  }

  const totalRooms = rooms.length;
  const occupancyRate =
    totalRooms > 0 ? Number(((occupiedCount / totalRooms) * 100).toFixed(1)) : 0;

  const revenueMap = new Map();
  for (const m of months) {
    revenueMap.set(m.month, {
      month: m.month,
      label: m.label,
      paidRevenue: 0,
      unpaidRevenue: 0,
      totalBilled: 0,
    });
  }

  let unpaidInvoicesCount = 0;
  let unpaidTotalAmount = 0;
  let overdueInvoicesCount = 0;

  for (const inv of invoices) {
    const paid = decToNumber(inv.paidAmount);
    const rem = decToNumber(inv.remainingAmount);
    const total = decToNumber(inv.totalAmount);

    if (['unpaid', 'partial', 'overdue'].includes(inv.status)) {
      unpaidInvoicesCount += 1;
      unpaidTotalAmount = roundMoney(unpaidTotalAmount + rem);
    }
    if (inv.status === 'overdue') overdueInvoicesCount += 1;

    if (monthKeys.includes(inv.billing_month)) {
      const entry = revenueMap.get(inv.billing_month);
      entry.paidRevenue = roundMoney(entry.paidRevenue + paid);
      entry.unpaidRevenue = roundMoney(entry.unpaidRevenue + rem);
      entry.totalBilled = roundMoney(entry.totalBilled + total);
    }
  }

  const revenueChart = Array.from(revenueMap.values());
  const currentEntry = revenueMap.get(currentMonth);

  const msPerDay = 24 * 60 * 60 * 1000;
  const formattedExpiring = expiringContracts.map((c) => ({
    ...c,
    daysRemaining: Math.ceil((new Date(c.endDate) - now) / msPerDay),
  }));

  res.status(200).json({
    success: true,
    data: {
      building: req.building,
      currentMonth,
      kpis: {
        totalRooms,
        availableCount,
        occupiedCount,
        reservedCount,
        maintenanceCount,
        pendingApprovalCount,
        occupancyRate,
        currentMonthRevenue: currentEntry ? currentEntry.paidRevenue : 0,
        currentMonthBilled: currentEntry ? currentEntry.totalBilled : 0,
        unpaidInvoicesCount,
        unpaidTotalAmount,
        overdueInvoicesCount,
        pendingDeposits,
        overdueManagerCash,
      },
      revenueChart,
      expiringContracts: formattedExpiring,
    },
  });
});

/**
 * GET /api/v1/dashboard/overview
 * Admin only. Aggregated stats across all buildings in req.user.tenantId.
 */
export const getSystemOverview = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const currentMonth = getLastNMonths(1)[0].month;

  const [buildings, rooms, invoices] = await Promise.all([
    Building.find({ tenantId })
      .populate({ path: 'primaryManagerId', match: { tenantId }, select: 'fullName email' })
      .sort({ createdAt: 1 })
      .lean(),
    Room.find({ tenantId }).select('building_id status').lean(),
    Invoice.find({ tenantId, status: { $ne: 'cancelled' } })
      .select('building_id billing_month status paidAmount remainingAmount')
      .lean(),
  ]);

  const roomStats = new Map();
  for (const r of rooms) {
    const key = r.building_id.toString();
    if (!roomStats.has(key)) roomStats.set(key, { total: 0, occupied: 0, available: 0 });
    const st = roomStats.get(key);
    st.total += 1;
    if (r.status === 'occupied') st.occupied += 1;
    else if (r.status === 'available') st.available += 1;
  }

  const revMap = new Map();
  const unpaidMap = new Map();

  for (const inv of invoices) {
    const key = inv.building_id.toString();
    if (inv.billing_month === currentMonth) {
      revMap.set(key, roundMoney((revMap.get(key) || 0) + decToNumber(inv.paidAmount)));
    }
    if (['unpaid', 'partial', 'overdue'].includes(inv.status)) {
      const u = unpaidMap.get(key) || { count: 0, amount: 0 };
      u.count += 1;
      u.amount = roundMoney(u.amount + decToNumber(inv.remainingAmount));
      unpaidMap.set(key, u);
    }
  }

  let totalRooms = 0;
  let totalOccupied = 0;
  let totalRevenue = 0;
  let totalUnpaidCount = 0;
  let totalUnpaidAmount = 0;

  const perBuilding = buildings.map((b) => {
    const key = b._id.toString();
    const rs = roomStats.get(key) || { total: 0, occupied: 0, available: 0 };
    const rev = revMap.get(key) || 0;
    const unpaid = unpaidMap.get(key) || { count: 0, amount: 0 };

    totalRooms += rs.total;
    totalOccupied += rs.occupied;
    totalRevenue = roundMoney(totalRevenue + rev);
    totalUnpaidCount += unpaid.count;
    totalUnpaidAmount = roundMoney(totalUnpaidAmount + unpaid.amount);

    return {
      _id: b._id,
      name: b.name,
      address: b.address,
      province_name: b.province_name,
      ward_name: b.ward_name,
      primaryManager: b.primaryManagerId,
      totalRooms: rs.total,
      occupiedCount: rs.occupied,
      availableCount: rs.available,
      occupancyRate: rs.total > 0 ? Number(((rs.occupied / rs.total) * 100).toFixed(1)) : 0,
      currentMonthRevenue: rev,
      unpaidInvoicesCount: unpaid.count,
      unpaidTotalAmount: unpaid.amount,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      currentMonth,
      summary: {
        totalBuildings: buildings.length,
        totalRooms,
        totalOccupied,
        occupancyRate: totalRooms > 0 ? Number(((totalOccupied / totalRooms) * 100).toFixed(1)) : 0,
        currentMonthRevenue: totalRevenue,
        unpaidInvoicesCount: totalUnpaidCount,
        unpaidTotalAmount: totalUnpaidAmount,
      },
      buildings: perBuilding,
    },
  });
});

/**
 * GET /api/v1/dashboard/audit-logs
 * Admin only. Strictly scoped by req.user.tenantId.
 */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { building_id, action } = req.query;
  const filter = { tenantId: req.user.tenantId };
  if (building_id) filter.building_id = building_id;
  if (action) filter.action = String(action);

  const logs = await AuditLog.find(filter)
    .populate({ path: 'building_id', select: 'name' })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.status(200).json({ success: true, data: logs });
});

/**
 * POST /api/v1/dashboard/run-scheduler
 * Admin manually triggers scheduled maintenance sweep (deposit expiry, reminders, late fees).
 */
export const triggerScheduler = asyncHandler(async (req, res) => {
  const report = await runScheduledJobs();
  res.status(200).json({
    success: true,
    message: 'Đã chạy tác vụ quét lịch tự động (Hết hạn giữ chỗ, nhắc nợ & hoa hồng)',
    data: report,
  });
});
