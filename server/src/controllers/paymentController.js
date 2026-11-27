import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Building from '../models/Building.js';
import { isValidObjectId } from '../config/db.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { recordInvoicePaymentTransaction } from '../services/transactionServices.js';

/**
 * POST /api/v1/payments/invoice
 * Records payment for an invoice (QR transfer or Cash).
 * Accessible by:
 * - Admin / Manager in buildingScopeGuard
 * - Resident paying their own invoice via QR transfer!
 */
export const payInvoice = asyncHandler(async (req, res) => {
  const { invoice_id, method = 'qr_transfer', amount, referenceNote = '', wrongCodeFlag = false } =
    req.body;

  if (!isValidObjectId(invoice_id)) throw new AppError('Mã hóa đơn không hợp lệ', 400);
  if (!['qr_transfer', 'cash'].includes(method)) {
    throw new AppError('Phương thức thanh toán phải là qr_transfer hoặc cash', 400);
  }

  let building = req.building;
  let tenantId = req.user.tenantId;

  if (req.user.role === 'user') {
    if (method !== 'qr_transfer') {
      throw new AppError('Cư dân thanh toán trực tuyến vui lòng chọn QR chuyển khoản', 400);
    }
    const inv = await Invoice.findOne({ _id: invoice_id, user_id: req.user._id }).lean();
    if (!inv) throw new AppError('Không tìm thấy hóa đơn của bạn', 404);
    building = await Building.findOne({ _id: inv.building_id, tenantId: inv.tenantId }).lean();
    tenantId = inv.tenantId;
  }

  const result = await recordInvoicePaymentTransaction({
    req,
    tenantId,
    building,
    invoiceId: invoice_id,
    method,
    amount,
    referenceNote,
    wrongCodeFlag: Boolean(wrongCodeFlag),
  });

  res.status(201).json({
    success: true,
    message:
      result.payment.status === 'pending'
        ? 'Đã ghi nhận giao dịch sai mã — chờ Admin đối soát'
        : 'Thanh toán hóa đơn thành công',
    data: result,
  });
});

/**
 * GET /api/v1/payments/building
 */
export const getBuildingPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  })
    .populate({ path: 'user_id', select: 'fullName email phone' })
    .populate({ path: 'collectedBy', select: 'fullName role' })
    .populate({ path: 'invoice_id', select: 'invoiceCode billing_month totalAmount status' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: payments });
});

/**
 * GET /api/v1/payments/my
 */
export const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user_id: req.user._id })
    .populate({ path: 'invoice_id', select: 'invoiceCode billing_month' })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ success: true, data: payments });
});

/**
 * PATCH /api/v1/payments/:id/remit-cash
 * Manager confirms cash remitted to company account (or Admin acknowledges receipt).
 */
export const remitCashPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã giao dịch không hợp lệ', 400);

  const payment = await Payment.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    method: 'cash',
  });
  if (!payment) throw new AppError('Không tìm thấy giao dịch tiền mặt', 404);
  if (payment.cashRemitStatus === 'remitted') {
    throw new AppError('Khoản tiền mặt này đã được nộp về công ty trước đó', 400);
  }

  payment.cashRemitStatus = 'remitted';
  payment.remittedAt = new Date();
  await payment.save();

  res.status(200).json({
    success: true,
    message: 'Đã xác nhận nộp tiền mặt về công ty',
    data: payment,
  });
});

/**
 * GET /api/v1/payments/my-cash-status
 * Returns Manager's unremitted cash balance, limit, and 24h overdue count.
 */
export const getManagerCashStatus = asyncHandler(async (req, res) => {
  const heldPayments = await Payment.find({
    tenantId: req.user.tenantId,
    collectedBy: req.user._id,
    method: 'cash',
    cashRemitStatus: { $in: ['held_by_manager', 'overdue_remit'] },
    status: 'confirmed',
  }).lean();

  const totalHeld = heldPayments.reduce((s, p) => s + Number(p.amount?.toString() || p.amount || 0), 0);
  const overdueCount = heldPayments.filter((p) => p.cashRemitStatus === 'overdue_remit').length;
  const cashLimit = Number(req.user.managerConfig?.cashLimit?.toString() || 50000000);

  res.status(200).json({
    success: true,
    data: {
      totalHeld,
      cashLimit,
      heldCount: heldPayments.length,
      overdueCount,
    },
  });
});

/**
 * PATCH /api/v1/payments/:id/reconcile
 * Admin confirms or rejects a pending wrong_code QR transfer payment.
 */
export const reconcilePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action = 'confirm' } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã giao dịch không hợp lệ', 400);

  const payment = await Payment.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    status: 'pending',
  });
  if (!payment) throw new AppError('Không tìm thấy giao dịch đang chờ đối soát', 404);

  if (action === 'reject') {
    payment.status = 'rejected';
    payment.confirmedBy = req.user._id;
    await payment.save();
    return res.status(200).json({ success: true, message: 'Đã từ chối giao dịch sai mã', data: payment });
  }

  payment.status = 'confirmed';
  payment.discrepancyType = 'exact';
  payment.confirmedBy = req.user._id;
  await payment.save();

  if (payment.invoice_id) {
    const inv = await Invoice.findOne({
      _id: payment.invoice_id,
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
    });
    if (inv) {
      const paidAmt = Number(inv.paidAmount?.toString() || 0) + Number(payment.amount?.toString() || 0);
      const total = Number(inv.totalAmount?.toString() || 0);
      const rem = Math.max(0, total - paidAmt);
      inv.paidAmount = String(paidAmt);
      inv.remainingAmount = String(rem);
      inv.status = rem === 0 ? 'paid' : 'partial';
      if (rem === 0) inv.paidAt = new Date();
      await inv.save();
    }
  }

  res.status(200).json({ success: true, message: 'Đã đối soát và xác nhận giao dịch', data: payment });
});
