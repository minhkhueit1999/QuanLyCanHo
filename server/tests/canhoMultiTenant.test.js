import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import AdminDivision from '../src/models/AdminDivision.js';
import User from '../src/models/User.js';
import { VIETNAM_34_DIVISIONS } from '../src/data/vietnam34Provinces.js';
import { runScheduledJobs } from '../src/services/schedulerService.js';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/canho_com_test';

// Minimal valid 1x1 PNG buffer encoded in base64 for RoomPhoto MongoDB storage test
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

let server;
let baseUrl;

async function req(path, { method = 'GET', token, buildingId, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (buildingId) headers['X-Building-Id'] = buildingId;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

before(async () => {
  process.env.JWT_SECRET = 'test_canho_com_secret_2026';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();

  await AdminDivision.insertMany(VIETNAM_34_DIVISIONS);

  const app = createApp();
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('canho.com Full Integration: User-Only Email Auth, RoomPhoto MongoDB, Multi-Tenant Isolation, RBAC, Decimal128 & ACID Flows', async () => {
  // 1. Verify full 34 provinces & 3,321 wards + "Bình Dương" legacy_alias -> TP. Hồ Chí Minh
  const allDivsRes = await req('/divisions');
  assert.equal(allDivsRes.status, 200);
  assert.equal(allDivsRes.data.data.length, 34);
  const totalWardsCount = allDivsRes.data.data.reduce((sum, d) => sum + (d.wards?.length || 0), 0);
  assert.equal(totalWardsCount, 3321);
  const hanoiDiv = allDivsRes.data.data.find((d) => d.admin_code === '01');
  const hcmDiv = allDivsRes.data.data.find((d) => d.admin_code === '79');
  assert.equal(hanoiDiv.wards.length, 126);
  assert.equal(hcmDiv.wards.length, 168);

  const divRes = await req('/divisions?q=Bình Dương');
  assert.equal(divRes.status, 200);
  assert.ok(divRes.data.data.some((d) => d.admin_code === '79'));

  // 2. Public Registration: MUST strictly allow role:'user' & block role escalation + require Email Verification (NO OTP)
  const badRoleReg = await req('/auth/register', {
    method: 'POST',
    body: {
      role: 'admin',
      fullName: 'Hacker Admin',
      email: 'hacker@canho.com',
      password: 'password123',
    },
  });
  assert.equal(badRoleReg.status, 403);

  const badScopeReg = await req('/auth/register', {
    method: 'POST',
    body: {
      assigned_building_ids: ['65f000000000000000000001'],
      fullName: 'Hacker Manager',
      email: 'hackermgr@canho.com',
      password: 'password123',
    },
  });
  assert.equal(badScopeReg.status, 403);

  const regUser = await req('/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Khách Thuê 1',
      email: 'guest1@canho.com',
      phone: '0988777666',
      password: 'password123',
    },
  });
  assert.equal(regUser.status, 201);
  assert.equal(regUser.data.data.user.role, 'user');
  assert.equal(regUser.data.data.user.userStatus, 'guest');
  assert.equal(regUser.data.data.user.isEmailVerified, false);
  const verifyToken = regUser.data.data.devVerificationToken;
  assert.ok(verifyToken);

  // Unverified login MUST be blocked (403 EMAIL_NOT_VERIFIED)
  const unverifiedLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: 'guest1@canho.com', password: 'password123' },
  });
  assert.equal(unverifiedLogin.status, 403);
  assert.equal(unverifiedLogin.data.code, 'EMAIL_NOT_VERIFIED');

  // Resend verification within 60s cooldown MUST return 429
  const immediateResend = await req('/auth/resend-verification', {
    method: 'POST',
    body: { email: 'guest1@canho.com' },
  });
  assert.equal(immediateResend.status, 429);

  // Confirm email verification token -> issues session JWT & marks isEmailVerified: true
  const verifiedRes = await req('/auth/verify-email', {
    method: 'POST',
    body: { token: verifyToken },
  });
  assert.equal(verifiedRes.status, 200);
  assert.equal(verifiedRes.data.data.user.isEmailVerified, true);
  const tokenUser = verifiedRes.data.data.token;
  const userId = verifiedRes.data.data.user._id;

  // 3. Provision Two Independent Admin Tenancies (Tenant A & Tenant B) via DB (Admin not public-registered)
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminAId = new mongoose.Types.ObjectId();
  const adminBId = new mongoose.Types.ObjectId();

  await User.create([
    {
      _id: adminAId,
      tenantId: adminAId,
      fullName: 'Chủ Đầu Tư A',
      email: 'owner.a@canho.com',
      password: passwordHash,
      role: 'admin',
      subRole: 'super_admin',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
    {
      _id: adminBId,
      tenantId: adminBId,
      fullName: 'Chủ Đầu Tư B',
      email: 'owner.b@canho.com',
      password: passwordHash,
      role: 'admin',
      subRole: 'super_admin',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  ]);

  const loginA = await req('/auth/login', {
    method: 'POST',
    body: { email: 'owner.a@canho.com', password: 'password123' },
  });
  assert.equal(loginA.status, 200);
  const tokenA = loginA.data.data.token;

  const loginB = await req('/auth/login', {
    method: 'POST',
    body: { email: 'owner.b@canho.com', password: 'password123' },
  });
  assert.equal(loginB.status, 200);
  const tokenB = loginB.data.data.token;

  // 4. Tenant A creates Building A1 (TP.HCM - Thủ Dầu Một, alias Bình Dương) & Building A2
  const bA1Res = await req('/buildings', {
    method: 'POST',
    token: tokenA,
    body: {
      name: 'canho.com Thủ Dầu Một',
      address: '88 Đại lộ Bình Dương',
      province_code: '79',
      ward_code: '25747',
      coordinates: [106.6525, 10.9804],
      totalFloors: 3,
    },
  });
  assert.equal(bA1Res.status, 201);
  assert.equal(bA1Res.data.data.ward_name, 'Phường Thủ Dầu Một');
  const bIdA1 = bA1Res.data.data._id;

  const bA2Res = await req('/buildings', {
    method: 'POST',
    token: tokenA,
    body: {
      name: 'canho.com Hà Nội',
      address: '10 Hàng Trống',
      province_code: '01',
      ward_code: '00070',
      totalFloors: 4,
    },
  });
  assert.equal(bA2Res.status, 201);
  assert.equal(bA2Res.data.data.ward_name, 'Phường Hoàn Kiếm');
  const bIdA2 = bA2Res.data.data._id;

  // Tenant B sees 0 of Tenant A's buildings & 0 audit logs before creating anything; Cross-tenant IDOR blocked (403)
  const listB = await req('/buildings', { token: tokenB });
  assert.equal(listB.status, 200);
  assert.equal(listB.data.data.length, 0);

  const emptyLogsB = await req('/dashboard/audit-logs', { token: tokenB });
  assert.equal(emptyLogsB.status, 200);
  assert.equal(emptyLogsB.data.data.length, 0);

  const bB1Res = await req('/buildings', {
    method: 'POST',
    token: tokenB,
    body: {
      name: 'Tenant B Tower',
      address: '99 Nguyễn Huệ',
      province_code: '79',
      ward_code: '26740',
      totalFloors: 2,
    },
  });
  assert.equal(bB1Res.status, 201);
  const bIdB1 = bB1Res.data.data._id;

  const crossTenantRooms = await req('/rooms', { token: tokenB, buildingId: bIdA1 });
  assert.equal(crossTenantRooms.status, 403);

  // 5. Tenant A creates Manager M1 (assigned ONLY A1) & Sub-Admin Ops (operations only)
  const createMgr = await req('/staff', {
    method: 'POST',
    token: tokenA,
    body: {
      role: 'manager',
      fullName: 'Manager A1',
      email: 'mgr.a1@canho.com',
      password: 'password123',
      assignedBuildings: [bIdA1],
      cashLimit: 10000000,
    },
  });
  assert.equal(createMgr.status, 201);
  const mgrId = createMgr.data.data._id;

  const hoRes = await req(`/buildings/${bIdA1}/handover-manager`, {
    method: 'POST',
    token: tokenA,
    body: { newManagerId: mgrId, note: 'Bàn giao ban đầu' },
  });
  assert.equal(hoRes.status, 200);
  assert.equal(hoRes.data.data.primaryManagerId, mgrId);

  const createOpsAdmin = await req('/staff', {
    method: 'POST',
    token: tokenA,
    body: {
      role: 'admin',
      subRole: 'operations',
      fullName: 'Sub-Admin Vận Hành',
      email: 'ops@canho.com',
      password: 'password123',
    },
  });
  assert.equal(createOpsAdmin.status, 201);

  const loginMgr = await req('/auth/login', {
    method: 'POST',
    body: { email: 'mgr.a1@canho.com', password: 'password123' },
  });
  const tokenMgr = loginMgr.data.data.token;

  assert.equal((await req('/rooms', { token: tokenMgr, buildingId: bIdA2 })).status, 403);
  assert.equal((await req('/dashboard/audit-logs', { token: tokenMgr })).status, 403);

  // 6. Room Creation + Direct MongoDB RoomPhoto Upload / Attach / Binary Stream / Cross-Tenant IDOR Check
  const proposeRoom = await req('/rooms', {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: {
      roomCode: 'P101',
      floor: 1,
      area: 35,
      maxOccupants: 2,
      base_price: 6000000,
      defaultDeposit: 6000000,
      description: 'Căn hộ thiết kế Neo-Chinese Luxury',
      amenities: ['Điều hòa', 'Ban công'],
    },
  });
  assert.equal(proposeRoom.status, 201);
  assert.equal(proposeRoom.data.data.status, 'pending_approval');
  const roomId = proposeRoom.data.data._id;

  const uploadPhotoRes = await req('/rooms/photos/upload', {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: {
      filename: 'canho-p101.png',
      title: 'Phòng khách P101',
      contentType: 'image/png',
      base64Data: TINY_PNG_DATA_URL,
      room_id: roomId,
    },
  });
  assert.equal(uploadPhotoRes.status, 201);
  const uploadedPhotoId = uploadPhotoRes.data.data._id;
  assert.equal(uploadPhotoRes.data.data.url, `/api/v1/rooms/photos/${uploadedPhotoId}`);

  // Binary GET stream returns valid PNG header + cache header
  const binaryRes = await fetch(`${baseUrl}/rooms/photos/${uploadedPhotoId}`);
  assert.equal(binaryRes.status, 200);
  assert.equal(binaryRes.headers.get('content-type'), 'image/png');
  assert.ok(binaryRes.headers.get('cache-control').includes('max-age=86400'));

  // Tenant B's photo library MUST NOT see Tenant A's uploaded photo & cannot delete it
  const libB = await req('/rooms/photos/library', { token: tokenB, buildingId: bIdB1 });
  assert.equal(libB.status, 200);
  assert.equal(
    libB.data.data.some((p) => String(p._id) === String(uploadedPhotoId)),
    false
  );
  const delB = await req(`/rooms/photos/${uploadedPhotoId}`, {
    method: 'DELETE',
    token: tokenB,
    buildingId: bIdB1,
  });
  assert.equal(delB.status, 404);

  // Manager blocked from approving own room -> Ops Sub-Admin approves -> Published!
  assert.equal(
    (await req(`/rooms/${roomId}/approve`, { method: 'PATCH', token: tokenMgr, buildingId: bIdA1, body: {} })).status,
    403
  );

  const loginOps = await req('/auth/login', {
    method: 'POST',
    body: { email: 'ops@canho.com', password: 'password123' },
  });
  const tokenOps = loginOps.data.data.token;

  const approveRes = await req(`/rooms/${roomId}/approve`, {
    method: 'PATCH',
    token: tokenOps,
    buildingId: bIdA1,
    body: { approvedPrice: 6000000 },
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.data.status, 'available');
  assert.equal(approveRes.data.data.isPublished, true);

  // Public Explore returns room P101 with its MongoDB photo URL and defaultDeposit
  const exploreRes = await req('/explore/rooms?search=Bình Dương&amenities=Điều hòa');
  assert.equal(exploreRes.status, 200);
  assert.equal(exploreRes.data.data.length, 1);
  assert.equal(exploreRes.data.data[0].roomCode, 'P101');
  assert.equal(exploreRes.data.data[0].defaultDeposit, 6000000);
  assert.equal(exploreRes.data.data[0].images[0], `/api/v1/rooms/photos/${uploadedPhotoId}`);

  // 7. Verified User deposits QR -> Submits proof (payment_verifying) -> Scheduler sweep MUST keep -> Manager confirms
  const depRes = await req('/deposits', {
    method: 'POST',
    token: tokenUser,
    body: { room_id: roomId, amount: 6000000, paymentMethod: 'qr_transfer' },
  });
  assert.equal(depRes.status, 201);
  const depId = depRes.data.data._id;

  const proofRes = await req(`/deposits/${depId}/submit-proof`, {
    method: 'PATCH',
    token: tokenUser,
    body: { paymentProofUrl: 'CK-12345' },
  });
  assert.equal(proofRes.status, 200);
  assert.equal(proofRes.data.data.status, 'payment_verifying');

  const sched = await runScheduledJobs();
  assert.equal(sched.expiredDeposits, 0);

  const confirmDep = await req(`/deposits/${depId}/confirm`, {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
  });
  assert.equal(confirmDep.status, 200);
  assert.equal(confirmDep.data.data.deposit.status, 'held');

  // 8. Activate Contract -> maxOccupants check -> Issue Invoice -> Proportional Commission -> Settle Checkout
  const badContract = await req('/contracts', {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: {
      room_id: roomId,
      user_id: userId,
      deposit_id: depId,
      occupants: [
        { fullName: 'A', phone: '1', idCard: '1' },
        { fullName: 'B', phone: '2', idCard: '2' },
        { fullName: 'C', phone: '3', idCard: '3' },
      ],
      startDate: '2026-11-01',
      endDate: '2027-11-01',
    },
  });
  assert.equal(badContract.status, 400);

  const goodContract = await req('/contracts', {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: {
      room_id: roomId,
      user_id: userId,
      deposit_id: depId,
      occupants: [{ fullName: 'Khách Thuê 1', phone: '0988777666', idCard: '079099001122', isPrimary: true }],
      startDate: '2026-11-01',
      endDate: '2027-11-01',
      handover: { elecInitial: 100, waterInitial: 10 },
    },
  });
  assert.equal(goodContract.status, 201);
  const contractId = goodContract.data.data._id;

  const invRes = await req('/invoices', {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: {
      contract_id: contractId,
      billing_month: '2026-11',
      elecOld: 100,
      elecNew: 200,
      elecPrice: 3500,
      waterOld: 10,
      waterNew: 15,
      waterPrice: 20000,
      roomFee: 6000000,
      managementFee: 150000,
    },
  });
  assert.equal(invRes.status, 201);
  assert.equal(invRes.data.data.totalAmount, 6600000);
  const invoiceId = invRes.data.data._id;

  assert.equal(
    (await req(`/invoices/${invoiceId}/cancel`, { method: 'PATCH', token: tokenOps, buildingId: bIdA1, body: { reason: 'test' } })).status,
    403
  );

  const payRes = await req('/payments/invoice', {
    method: 'POST',
    token: tokenUser,
    body: { invoice_id: invoiceId, method: 'qr_transfer', amount: 6600000 },
  });
  assert.equal(payRes.status, 201);
  assert.equal(payRes.data.data.invoice.status, 'paid');
  assert.equal(payRes.data.data.commission.commissionAmount, 300000);

  const cashStatusRes = await req('/payments/my-cash-status', { token: tokenMgr });
  assert.equal(cashStatusRes.status, 200);
  assert.equal(cashStatusRes.data.data.totalHeld, 0);

  const extRes = await req(`/contracts/${contractId}/extend`, {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: { newEndDate: '2028-11-01' },
  });
  assert.equal(extRes.status, 200);

  const settleRes = await req(`/contracts/${contractId}/settle-checkout`, {
    method: 'POST',
    token: tokenMgr,
    buildingId: bIdA1,
    body: {
      finalElecOld: 200,
      finalElecNew: 210,
      finalWaterOld: 15,
      finalWaterNew: 15,
      damageCompensation: 200000,
      note: 'Trừ 200k vệ sinh nệm',
    },
  });
  assert.equal(settleRes.status, 200);
  assert.equal(settleRes.data.data.settlement.netRefund, 5765000);

  // Verify AuditLogs strictly isolated between Tenant A and Tenant B (B only has its own CREATE_BUILDING log)
  const logsA = await req('/dashboard/audit-logs', { token: tokenA });
  assert.equal(logsA.status, 200);
  assert.ok(logsA.data.data.length >= 3);
  assert.ok(logsA.data.data.every((l) => String(l.tenantId) === String(adminAId)));

  const logsB = await req('/dashboard/audit-logs', { token: tokenB });
  assert.equal(logsB.status, 200);
  assert.equal(logsB.data.data.length, 1);
  assert.ok(logsB.data.data.every((l) => String(l.tenantId) === String(adminBId)));
});
