import Invoice from '../models/Invoice.js';
import Contract from '../models/Contract.js';
import ServiceTicket from '../models/ServiceTicket.js';
import { isValidObjectId } from '../config/db.js';
import { decToNumber, roundMoney, toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function genInvoiceCode(month, roomCode) {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${month.replace('-', '')}-${roomCode}-${rand}`;
}

/**
 * GET /api/v1/invoices/worksheet?month=YYYY-MM
 * Prepares monthly billing rows for active contracts with:
 * - Previous month's elecNew/waterNew (or contract handover initial readings)
 * - Parking fees from contract vehicles
 * - Completed unbilled service tickets for billing_month
 * - Previous unpaid debt
 */
export const getInvoiceWorksheet = asyncHandler(async (req, res) => {
  const month = req.query.month ? String(req.query.month).trim() : getCurrentMonth();
  if (!MONTH_REGEX.test(month)) throw new AppError('Định dạng tháng phải là YYYY-MM', 400);

  const [contracts, existingInvoices, completedTickets, unpaidOlderInvoices] = await Promise.all([
    Contract.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      status: { $in: ['active', 'checkout_requested'] },
    })
      .populate({
        path: 'room_id',
        match: { tenantId: req.user.tenantId, building_id: req.buildingId },
        select: 'roomCode floor area',
      })
      .populate({ path: 'user_id', select: 'fullName phone email' })
      .lean(),
    Invoice.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      billing_month: month,
      status: { $ne: 'cancelled' },
    }).lean(),
    ServiceTicket.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      status: { $in: ['completed', 'verified'] },
      billedInInvoiceId: null,
      ticketType: { $in: ['add_on_service', 'maintenance_resident_fault'] },
    }).lean(),
    Invoice.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      billing_month: { $lt: month },
      status: { $in: ['unpaid', 'partial', 'overdue'] },
    }).lean(),
  ]);

  const invoiceByContract = new Map(existingInvoices.map((i) => [i.contract_id.toString(), i]));

  // Find latest previous meter readings per contract
  const missingContractIds = contracts
    .filter((c) => !invoiceByContract.has(c._id.toString()))
    .map((c) => c._id);

  const prevInvMap = new Map();
  if (missingContractIds.length > 0) {
    const prevInvoices = await Invoice.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      contract_id: { $in: missingContractIds },
      billing_month: { $lt: month },
      status: { $ne: 'cancelled' },
    })
      .sort({ billing_month: -1 })
      .lean();

    for (const p of prevInvoices) {
      const key = p.contract_id.toString();
      if (!prevInvMap.has(key)) prevInvMap.set(key, p);
    }
  }

  const rows = contracts.map((c) => {
    const cKey = c._id.toString();
    const existing = invoiceByContract.get(cKey);
    if (existing) {
      return {
        contract: c,
        room: c.room_id,
        resident: c.user_id,
        invoiceId: existing._id,
        invoiceCode: existing.invoiceCode,
        isSaved: true,
        billing_month: month,
        dueDate: existing.dueDate,
        elecOld: existing.elecOld,
        elecNew: existing.elecNew,
        elecPrice: decToNumber(existing.elecPrice),
        elecProofUrl: existing.elecProofUrl,
        waterOld: existing.waterOld,
        waterNew: existing.waterNew,
        waterPrice: decToNumber(existing.waterPrice),
        waterProofUrl: existing.waterProofUrl,
        roomFee: decToNumber(existing.roomFee),
        managementFee: decToNumber(existing.managementFee),
        parkingFee: decToNumber(existing.parkingFee),
        serviceFee: decToNumber(existing.serviceFee),
        previousDebt: decToNumber(existing.previousDebt),
        discountAmount: decToNumber(existing.discountAmount),
        lateFee: decToNumber(existing.lateFee),
        totalAmount: decToNumber(existing.totalAmount),
        paidAmount: decToNumber(existing.paidAmount),
        remainingAmount: decToNumber(existing.remainingAmount),
        status: existing.status,
      };
    }

    const prev = prevInvMap.get(cKey);
    const elecOld = prev ? prev.elecNew : c.handover?.elecInitial || 0;
    const waterOld = prev ? prev.waterNew : c.handover?.waterInitial || 0;

    const motoPrice = decToNumber(c.pricingSnapshot?.parkingFeeMotorbike);
    const carPrice = decToNumber(c.pricingSnapshot?.parkingFeeCar);
    const parkingFee = roundMoney(
      (c.vehicles || []).reduce(
        (sum, v) => sum + (v.type === 'car' ? carPrice : motoPrice),
        0
      )
    );

    const roomTickets = completedTickets.filter(
      (t) => t.room_id.toString() === c.room_id?._id?.toString()
    );
    const serviceFee = roundMoney(
      roomTickets.reduce((sum, t) => sum + decToNumber(t.quotedPrice), 0)
    );

    const previousDebt = roundMoney(
      unpaidOlderInvoices
        .filter((u) => u.contract_id.toString() === cKey)
        .reduce((sum, u) => sum + decToNumber(u.remainingAmount), 0)
    );

    const roomFee = decToNumber(c.monthlyRent);
    const managementFee = decToNumber(c.pricingSnapshot?.managementFee);
    const discountAmount = decToNumber(c.discountAmount);
    const totalAmount = Math.max(
      0,
      roundMoney(roomFee + managementFee + parkingFee + serviceFee + previousDebt - discountAmount)
    );

    const [y, m] = month.split('-').map(Number);
    const defaultDue = new Date(y, m - 1, 5); // 5th of billing month

    return {
      contract: c,
      room: c.room_id,
      resident: c.user_id,
      invoiceId: null,
      invoiceCode: null,
      isSaved: false,
      billing_month: month,
      dueDate: defaultDue,
      elecOld,
      elecNew: elecOld,
      elecPrice: decToNumber(c.pricingSnapshot?.electricityPrice),
      elecProofUrl: '',
      waterOld,
      waterNew: waterOld,
      waterPrice: decToNumber(c.pricingSnapshot?.waterPrice),
      waterProofUrl: '',
      roomFee,
      managementFee,
      parkingFee,
      serviceFee,
      previousDebt,
      discountAmount,
      lateFee: 0,
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      status: 'draft',
      pendingServiceTicketIds: roomTickets.map((t) => t._id),
    };
  });

  res.status(200).json({
    success: true,
    data: {
      billing_month: month,
      rows,
    },
  });
});

/**
 * GET /api/v1/invoices/my
 * Resident views their own invoices.
 */
export const getMyInvoices = asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({
    user_id: req.user._id,
    status: { $ne: 'cancelled' },
  })
    .populate({ path: 'building_id', select: 'name address' })
    .populate({ path: 'room_id', select: 'roomCode floor' })
    .sort({ billing_month: -1 })
    .lean();

  res.status(200).json({ success: true, data: invoices });
});

/**
 * POST /api/v1/invoices
 * Issues a monthly invoice (or updates draft/unpaid if Admin with AuditLog!).
 */
export const upsertInvoice = asyncHandler(async (req, res) => {
  const {
    contract_id,
    billing_month,
    dueDate,
    elecOld,
    elecNew,
    elecPrice,
    elecProofUrl = '',
    waterOld,
    waterNew,
    waterPrice,
    waterProofUrl = '',
    roomFee,
    managementFee = 0,
    parkingFee = 0,
    serviceFee = 0,
    previousDebt = 0,
    discountAmount = 0,
    serviceTicketIds = [],
    adminReason = '',
  } = req.body;

  if (!isValidObjectId(contract_id)) throw new AppError('Mã hợp đồng không hợp lệ', 400);
  if (!MONTH_REGEX.test(String(billing_month))) {
    throw new AppError('Kỳ hóa đơn phải là YYYY-MM', 400);
  }

  const contract = await Contract.findOne({
    _id: contract_id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  })
    .populate({ path: 'room_id', select: 'roomCode' })
    .lean();

  if (!contract) throw new AppError('Không tìm thấy hợp đồng trong tòa nhà', 404);

  const eOld = Number(elecOld);
  const eNew = Number(elecNew);
  const wOld = Number(waterOld);
  const wNew = Number(waterNew);
  if (eNew < eOld || wNew < wOld) {
    throw new AppError('Chỉ số điện/nước mới phải lớn hơn hoặc bằng chỉ số cũ', 400);
  }

  const ePrice = Number(elecPrice ?? decToNumber(contract.pricingSnapshot?.electricityPrice));
  const wPrice = Number(waterPrice ?? decToNumber(contract.pricingSnapshot?.waterPrice));
  const rFee = Number(roomFee ?? decToNumber(contract.monthlyRent));
  const mFee = Number(managementFee);
  const pFee = Number(parkingFee);
  const sFee = Number(serviceFee);
  const pDebt = Number(previousDebt);
  const disc = Number(discountAmount);

  const totalNum = Math.max(
    0,
    roundMoney(
      (eNew - eOld) * ePrice +
        (wNew - wOld) * wPrice +
        rFee +
        mFee +
        pFee +
        sFee +
        pDebt -
        disc
    )
  );

  const existing = await Invoice.findOne({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    contract_id: contract._id,
    billing_month: String(billing_month),
    status: { $ne: 'cancelled' },
  });

  if (existing) {
    // Editing an already issued invoice or locked meter readings requires ADMIN + AuditLog!
    if (req.user.role !== 'admin') {
      throw new AppError(
        'Hóa đơn đã phát hành và chốt chỉ số. Chỉ Admin mới có quyền chỉnh sửa & ghi Audit Log.',
        403
      );
    }
    if (existing.status === 'paid') {
      throw new AppError('Không thể chỉnh sửa hóa đơn đã thanh toán hoàn tất', 400);
    }

    const before = existing.toObject();
    const paidAlready = decToNumber(existing.paidAmount);
    existing.elecOld = eOld;
    existing.elecNew = eNew;
    existing.elecPrice = toDecimal128(ePrice);
    existing.elecProofUrl = elecProofUrl;
    existing.waterOld = wOld;
    existing.waterNew = wNew;
    existing.waterPrice = toDecimal128(wPrice);
    existing.waterProofUrl = waterProofUrl;
    existing.roomFee = toDecimal128(rFee);
    existing.managementFee = toDecimal128(mFee);
    existing.parkingFee = toDecimal128(pFee);
    existing.serviceFee = toDecimal128(sFee);
    existing.previousDebt = toDecimal128(pDebt);
    existing.discountAmount = toDecimal128(disc);
    existing.totalAmount = toDecimal128(totalNum);
    existing.remainingAmount = toDecimal128(Math.max(0, roundMoney(totalNum - paidAlready)));
    if (dueDate) existing.dueDate = new Date(dueDate);
    await existing.save();

    await recordAuditLog({
      req,
      tenantId: req.user.tenantId,
      buildingId: req.buildingId,
      action: 'EDIT_ISSUED_INVOICE_OR_METER',
      targetModel: 'Invoice',
      targetId: existing._id,
      reason: adminReason || 'Admin điều chỉnh hóa đơn/chỉ số đã chốt',
      beforeState: {
        elecNew: before.elecNew,
        waterNew: before.waterNew,
        totalAmount: decToNumber(before.totalAmount),
      },
      afterState: { elecNew: eNew, waterNew: wNew, totalAmount: totalNum },
    });

    return res.status(200).json({
      success: true,
      message: `Admin đã cập nhật hóa đơn ${existing.invoiceCode}`,
      data: existing,
    });
  }

  const [y, m] = String(billing_month).split('-').map(Number);
  const invoice = await Invoice.create({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    room_id: contract.room_id._id || contract.room_id,
    contract_id: contract._id,
    user_id: contract.user_id,
    invoiceCode: genInvoiceCode(String(billing_month), contract.room_id?.roomCode || 'ROOM'),
    billing_month: String(billing_month),
    dueDate: dueDate ? new Date(dueDate) : new Date(y, m - 1, 5),
    elecOld: eOld,
    elecNew: eNew,
    elecPrice: toDecimal128(ePrice),
    elecProofUrl,
    waterOld: wOld,
    waterNew: wNew,
    waterPrice: toDecimal128(wPrice),
    waterProofUrl,
    roomFee: toDecimal128(rFee),
    managementFee: toDecimal128(mFee),
    parkingFee: toDecimal128(pFee),
    serviceFee: toDecimal128(sFee),
    previousDebt: toDecimal128(pDebt),
    discountAmount: toDecimal128(disc),
    lateFee: toDecimal128(0),
    totalAmount: toDecimal128(totalNum),
    paidAmount: toDecimal128(0),
    remainingAmount: toDecimal128(totalNum),
    serviceTicketIds,
    status: 'unpaid',
  });

  if (Array.isArray(serviceTicketIds) && serviceTicketIds.length > 0) {
    await ServiceTicket.updateMany(
      { _id: { $in: serviceTicketIds }, tenantId: req.user.tenantId, building_id: req.buildingId },
      { $set: { billedInInvoiceId: invoice._id, billing_month: String(billing_month) } }
    );
  }

  res.status(201).json({
    success: true,
    message: `Đã phát hành hóa đơn ${invoice.invoiceCode}`,
    data: invoice,
  });
});

/**
 * PATCH /api/v1/invoices/:id/waive-late-fee
 * Sensitive Action: Admin only + AuditLog.
 */
export const waiveLateFee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã hóa đơn không hợp lệ', 400);

  const invoice = await Invoice.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!invoice) throw new AppError('Không tìm thấy hóa đơn', 404);

  const currentLate = decToNumber(invoice.lateFee);
  const reason = String(req.body.reason || 'Miễn giảm phí trễ hạn').trim();

  invoice.lateFeeWaived = true;
  invoice.lateFee = toDecimal128(0);
  invoice.totalAmount = toDecimal128(Math.max(0, roundMoney(decToNumber(invoice.totalAmount) - currentLate)));
  invoice.remainingAmount = toDecimal128(
    Math.max(0, roundMoney(decToNumber(invoice.remainingAmount) - currentLate))
  );
  if (invoice.status === 'overdue' && decToNumber(invoice.remainingAmount) > 0) {
    invoice.status = decToNumber(invoice.paidAmount) > 0 ? 'partial' : 'unpaid';
  }
  await invoice.save();

  await recordAuditLog({
    req,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
    action: 'WAIVE_LATE_FEE',
    targetModel: 'Invoice',
    targetId: invoice._id,
    reason,
    beforeState: { lateFee: currentLate },
    afterState: { lateFee: 0, lateFeeWaived: true },
  });

  res.status(200).json({
    success: true,
    message: 'Đã miễn phí trễ hạn và ghi nhận Audit Log',
    data: invoice,
  });
});

/**
 * PATCH /api/v1/invoices/:id/cancel
 * Sensitive Action: Admin only + AuditLog.
 */
export const cancelInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã hóa đơn không hợp lệ', 400);

  const invoice = await Invoice.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!invoice) throw new AppError('Không tìm thấy hóa đơn', 404);
  if (invoice.status === 'paid' || decToNumber(invoice.paidAmount) > 0) {
    throw new AppError('Không thể hủy hóa đơn đã phát sinh thanh toán', 400);
  }

  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new AppError('Vui lòng nhập lý do hủy hóa đơn để lưu Audit Log', 400);

  const prevStatus = invoice.status;
  invoice.status = 'cancelled';
  invoice.note = reason;
  await invoice.save();

  await ServiceTicket.updateMany(
    { billedInInvoiceId: invoice._id, tenantId: req.user.tenantId },
    { $set: { billedInInvoiceId: null } }
  );

  await recordAuditLog({
    req,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
    action: 'CANCEL_INVOICE',
    targetModel: 'Invoice',
    targetId: invoice._id,
    reason,
    beforeState: { status: prevStatus },
    afterState: { status: 'cancelled' },
  });

  res.status(200).json({
    success: true,
    message: `Đã hủy hóa đơn ${invoice.invoiceCode} và lưu Audit Log`,
    data: invoice,
  });
});
