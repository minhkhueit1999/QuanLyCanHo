import express from 'express';
import { authenticate, optionalAuth, requireRoles, requireAdminSubRole } from '../middlewares/auth.js';
import { buildingScopeGuard } from '../middlewares/buildingScope.js';

import { register, login, getMe } from '../controllers/authController.js';
import { getDivisions } from '../controllers/divisionController.js';
import { exploreRooms, getExploreRoomDetail } from '../controllers/exploreController.js';
import {
  getBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  handoverManager,
} from '../controllers/buildingController.js';
import { getStaff, createStaff, updateStaff, deleteStaff } from '../controllers/staffController.js';
import {
  getRooms,
  createRoom,
  batchCreateRooms,
  updateRoom,
  approveRoom,
  deleteRoom,
} from '../controllers/roomController.js';
import {
  getPhotoLibrary,
  getRoomPhotoById,
  uploadRoomPhoto,
  attachPhotosToRoom,
  deleteRoomPhoto,
} from '../controllers/roomPhotoController.js';
import {
  createViewBooking,
  getMyViewBookings,
  getBuildingViewBookings,
  updateBookingOutcome,
} from '../controllers/bookingController.js';
import {
  createDeposit,
  getMyDeposits,
  getBuildingDeposits,
  submitDepositProof,
  confirmDeposit,
  refundDeposit,
  forfeitDeposit,
} from '../controllers/depositController.js';
import {
  getBuildingContracts,
  getMyContracts,
  createContract,
  updateOccupantsAndVehicles,
  changeContractRoom,
  transferContract,
  extendContract,
  requestCheckout,
  settleCheckout,
} from '../controllers/contractController.js';
import {
  getInvoiceWorksheet,
  getMyInvoices,
  upsertInvoice,
  waiveLateFee,
  cancelInvoice,
} from '../controllers/invoiceController.js';
import {
  payInvoice,
  getBuildingPayments,
  getMyPayments,
  remitCashPayment,
  getManagerCashStatus,
  reconcilePayment,
} from '../controllers/paymentController.js';
import {
  getBuildingCommissions,
  disputeCommission,
  updateCommissionStatus,
} from '../controllers/commissionController.js';
import {
  createServiceTicket,
  getBuildingTickets,
  getMyTickets,
  processTicket,
  confirmTicketQuote,
  rateTicket,
} from '../controllers/serviceController.js';
import {
  getBuildingViolations,
  getMyViolations,
  issueViolation,
  updateViolationStatus,
} from '../controllers/violationController.js';
import {
  getBuildingDashboard,
  getSystemOverview,
  getAuditLogs,
  triggerScheduler,
} from '../controllers/dashboardController.js';

const router = express.Router();

// Auth (Public register strictly role:'user', direct activation without email verification/OTP)
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authenticate, getMe);

// 34 Provinces / Wards & Public Explore
router.get('/divisions', getDivisions);
router.get('/explore/rooms', optionalAuth, exploreRooms);
router.get('/explore/rooms/:id', optionalAuth, getExploreRoomDetail);

// Buildings & Staff (Admin / Manager)
router.get('/buildings', authenticate, requireRoles('admin', 'manager'), getBuildings);
router.post('/buildings', authenticate, requireRoles('admin'), requireAdminSubRole('operations'), createBuilding);
router.put('/buildings/:id', authenticate, requireRoles('admin'), requireAdminSubRole('operations', 'accountant'), updateBuilding);
router.post('/buildings/:id/handover-manager', authenticate, requireRoles('admin'), handoverManager);
router.delete('/buildings/:id', authenticate, requireRoles('admin'), deleteBuilding);

router.get('/staff', authenticate, requireRoles('admin'), getStaff);
router.post('/staff', authenticate, requireRoles('admin'), createStaff);
router.put('/staff/:id', authenticate, requireRoles('admin'), updateStaff);
router.delete('/staff/:id', authenticate, requireRoles('admin'), deleteStaff);

// Room Photos stored in MongoDB (library & upload are strictly scoped; :photoId streams binary)
router.get('/rooms/photos/library', authenticate, buildingScopeGuard, getPhotoLibrary);
router.post('/rooms/photos/upload', authenticate, buildingScopeGuard, uploadRoomPhoto);
router.get('/rooms/photos/:photoId', getRoomPhotoById);
router.delete('/rooms/photos/:photoId', authenticate, buildingScopeGuard, deleteRoomPhoto);

// Rooms (Building Scoped)
router.get('/rooms', authenticate, buildingScopeGuard, getRooms);
router.post('/rooms/batch', authenticate, buildingScopeGuard, batchCreateRooms);
router.post('/rooms', authenticate, buildingScopeGuard, createRoom);
router.post('/rooms/:id/photos/attach', authenticate, buildingScopeGuard, attachPhotosToRoom);
router.put('/rooms/:id', authenticate, buildingScopeGuard, updateRoom);
router.patch('/rooms/:id/approve', authenticate, requireRoles('admin'), requireAdminSubRole('operations'), buildingScopeGuard, approveRoom);
router.delete('/rooms/:id', authenticate, buildingScopeGuard, deleteRoom);

// View Bookings
router.post('/bookings', optionalAuth, createViewBooking);
router.get('/bookings/my', authenticate, getMyViewBookings);
router.get('/bookings/building', authenticate, buildingScopeGuard, getBuildingViewBookings);
router.patch('/bookings/:id/outcome', authenticate, buildingScopeGuard, updateBookingOutcome);

// Deposits
router.post('/deposits', authenticate, createDeposit);
router.get('/deposits/my', authenticate, getMyDeposits);
router.get('/deposits/building', authenticate, buildingScopeGuard, getBuildingDeposits);
router.patch('/deposits/:id/submit-proof', authenticate, submitDepositProof);
router.post('/deposits/:id/confirm', authenticate, buildingScopeGuard, confirmDeposit);
router.post('/deposits/:id/refund', authenticate, requireRoles('admin'), requireAdminSubRole('accountant'), buildingScopeGuard, refundDeposit);
router.post('/deposits/:id/forfeit', authenticate, buildingScopeGuard, forfeitDeposit);

// Contracts
router.get('/contracts/my', authenticate, getMyContracts);
router.get('/contracts/building', authenticate, buildingScopeGuard, getBuildingContracts);
router.post('/contracts', authenticate, buildingScopeGuard, createContract);
router.put('/contracts/:id/occupants-vehicles', authenticate, buildingScopeGuard, updateOccupantsAndVehicles);
router.post('/contracts/:id/change-room', authenticate, buildingScopeGuard, changeContractRoom);
router.post('/contracts/:id/transfer', authenticate, buildingScopeGuard, transferContract);
router.post('/contracts/:id/extend', authenticate, buildingScopeGuard, extendContract);
router.post('/contracts/:id/request-checkout', authenticate, requestCheckout);
router.post('/contracts/:id/settle-checkout', authenticate, buildingScopeGuard, settleCheckout);

// Invoices
router.get('/invoices/my', authenticate, getMyInvoices);
router.get('/invoices/worksheet', authenticate, buildingScopeGuard, getInvoiceWorksheet);
router.post('/invoices', authenticate, buildingScopeGuard, upsertInvoice);
router.patch('/invoices/:id/waive-late-fee', authenticate, requireRoles('admin'), requireAdminSubRole('accountant'), buildingScopeGuard, waiveLateFee);
router.patch('/invoices/:id/cancel', authenticate, requireRoles('admin'), requireAdminSubRole('accountant'), buildingScopeGuard, cancelInvoice);

// Payments
router.get('/payments/my', authenticate, getMyPayments);
router.get('/payments/my-cash-status', authenticate, requireRoles('admin', 'manager'), getManagerCashStatus);
router.get('/payments/building', authenticate, buildingScopeGuard, getBuildingPayments);
router.post('/payments/invoice', authenticate, (req, res, next) => {
  if (req.user.role === 'user') return next();
  return buildingScopeGuard(req, res, next);
}, payInvoice);
router.patch('/payments/:id/remit-cash', authenticate, buildingScopeGuard, remitCashPayment);
router.patch('/payments/:id/reconcile', authenticate, requireRoles('admin'), requireAdminSubRole('accountant'), buildingScopeGuard, reconcilePayment);

// Commissions
router.get('/commissions/building', authenticate, buildingScopeGuard, getBuildingCommissions);
router.post('/commissions/:id/dispute', authenticate, buildingScopeGuard, disputeCommission);
router.patch('/commissions/:id/status', authenticate, requireRoles('admin'), requireAdminSubRole('accountant'), buildingScopeGuard, updateCommissionStatus);

// Service Tickets & Maintenance
router.post('/services', authenticate, (req, res, next) => {
  if (req.user.role === 'user') return next();
  return buildingScopeGuard(req, res, next);
}, createServiceTicket);
router.get('/services/my', authenticate, getMyTickets);
router.get('/services/building', authenticate, buildingScopeGuard, getBuildingTickets);
router.patch('/services/:id/process', authenticate, buildingScopeGuard, processTicket);
router.patch('/services/:id/confirm-quote', authenticate, confirmTicketQuote);
router.patch('/services/:id/rate', authenticate, rateTicket);

// Violations
router.get('/violations/my', authenticate, getMyViolations);
router.get('/violations/building', authenticate, buildingScopeGuard, getBuildingViolations);
router.post('/violations', authenticate, buildingScopeGuard, issueViolation);
router.patch('/violations/:id/status', authenticate, buildingScopeGuard, updateViolationStatus);

// Dashboard, Audit Logs & Scheduler
router.get('/dashboard/building', authenticate, buildingScopeGuard, getBuildingDashboard);
router.get('/dashboard/overview', authenticate, requireRoles('admin'), getSystemOverview);
router.get('/dashboard/audit-logs', authenticate, requireRoles('admin'), getAuditLogs);
router.post('/dashboard/run-scheduler', authenticate, requireRoles('admin'), triggerScheduler);

export default router;
