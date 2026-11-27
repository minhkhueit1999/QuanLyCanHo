import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { toDecimal128, roundMoney } from '../utils/decimal.js';
import { VIETNAM_34_DIVISIONS } from '../data/vietnam34Provinces.js';
import { buildPhotoUrl } from '../controllers/roomPhotoController.js';

import User from '../models/User.js';
import AdminDivision from '../models/AdminDivision.js';
import Building from '../models/Building.js';
import Room from '../models/Room.js';
import RoomPhoto from '../models/RoomPhoto.js';
import ViewBooking from '../models/ViewBooking.js';
import Deposit from '../models/Deposit.js';
import Contract from '../models/Contract.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Commission from '../models/Commission.js';
import ServiceTicket from '../models/ServiceTicket.js';
import Violation from '../models/Violation.js';
import AuditLog from '../models/AuditLog.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..', '..');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/canho_com';

const PHOTO_TITLES = [
  'Phòng khách & Bàn ăn gỗ sang trọng',
  'Studio giường gỗ ấm áp & Bếp liền kề',
  'Căn hộ bếp hiện đại & Ban công sáng',
  'Phòng khách Sofa xanh & Nội thất đồng bộ',
  'Không gian bàn ăn & Cửa kính đón nắng',
  'Phòng khách gỗ trầm Neo-Chinese Luxury',
];

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function syncAllModels() {
  const models = [
    User,
    AdminDivision,
    Building,
    Room,
    RoomPhoto,
    ViewBooking,
    Deposit,
    Contract,
    Invoice,
    Payment,
    Commission,
    ServiceTicket,
    Violation,
    AuditLog,
  ];
  for (const Model of models) {
    await Model.createCollection();
    await Model.syncIndexes();
  }
}

async function seed34Divisions() {
  const ops = VIETNAM_34_DIVISIONS.map((div) => ({
    updateOne: {
      filter: { admin_code: div.admin_code },
      update: { $set: div },
      upsert: true,
    },
  }));
  await AdminDivision.bulkWrite(ops);
  const divisions = await AdminDivision.find({}).select('wards.ward_code').lean();
  const totalWards = divisions.reduce((sum, d) => sum + (d.wards?.length || 0), 0);
  console.log(
    `[Seed] Synced ${divisions.length} Vietnamese consolidated provinces/cities and ${totalWards} wards/communes.`
  );
}

async function seedRoomPhotosFromEnvDir() {
  const configuredDir = process.env.SEED_ROOM_PHOTOS_DIR || './assets/room-photos';
  const resolvedDir = path.isAbsolute(configuredDir)
    ? configuredDir
    : path.resolve(serverRoot, configuredDir);

  let files = [];
  try {
    const entries = await fs.readdir(resolvedDir);
    files = entries
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.warn(`[Seed] Could not read SEED_ROOM_PHOTOS_DIR (${resolvedDir}):`, err.message);
    return [];
  }

  const seededPhotos = [];
  for (let i = 0; i < files.length; i += 1) {
    const filename = files[i];
    const filePath = path.join(resolvedDir, filename);
    const buffer = await fs.readFile(filePath);
    const contentType = getMimeType(filename);
    const title = PHOTO_TITLES[i] || `Ảnh mẫu căn hộ ${i + 1}`;

    const photo = await RoomPhoto.findOneAndUpdate(
      { filename, isSeedLibrary: true },
      {
        $set: {
          filename,
          title,
          contentType,
          size: buffer.length,
          data: buffer,
          isSeedLibrary: true,
        },
      },
      { upsert: true, new: true }
    );
    seededPhotos.push(photo);
  }

  console.log(`[Seed] Stored ${seededPhotos.length} room photos directly in MongoDB (room_photos).`);
  return seededPhotos;
}

async function seedDemoData(seededPhotos) {
  const adminEmail = 'admin@canho.com';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const adminId = new mongoose.Types.ObjectId();
    admin = await User.create({
      _id: adminId,
      fullName: 'Chủ Đầu Tư canho.com',
      email: adminEmail,
      phone: '0909000111',
      password: await bcrypt.hash('Admin@123456', 10),
      role: 'admin',
      subRole: 'super_admin',
      userStatus: 'resident',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      tenantId: adminId,
      assignedBuildings: [],
    });
  } else if (!admin.isEmailVerified) {
    admin.isEmailVerified = true;
    admin.emailVerifiedAt = new Date();
    await admin.save();
  }

  let manager = await User.findOne({ email: 'manager@canho.com' });
  if (!manager) {
    manager = await User.create({
      fullName: 'Nguyễn Quản Lý',
      email: 'manager@canho.com',
      phone: '0909000222',
      password: await bcrypt.hash('Manager@123456', 10),
      role: 'manager',
      userStatus: 'resident',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      tenantId: admin.tenantId,
      assignedBuildings: [],
      managerConfig: { cashLimit: toDecimal128(50000000) },
    });
  } else if (!manager.isEmailVerified) {
    manager.isEmailVerified = true;
    manager.emailVerifiedAt = new Date();
    await manager.save();
  }

  let residentUser = await User.findOne({ email: 'cudan@canho.com' });
  if (!residentUser) {
    residentUser = await User.create({
      fullName: 'Trần Minh Khang',
      email: 'cudan@canho.com',
      phone: '0912345678',
      idCard: '079098008899',
      password: await bcrypt.hash('Cudan@123456', 10),
      role: 'user',
      userStatus: 'resident',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      tenantId: null,
    });
  } else if (!residentUser.isEmailVerified) {
    residentUser.isEmailVerified = true;
    residentUser.emailVerifiedAt = new Date();
    await residentUser.save();
  }

  const pickGallery = (indices) => {
    const selected = indices.map((idx) => seededPhotos[idx]).filter(Boolean);
    return {
      photoIds: selected.map((p) => p._id),
      images: selected.map((p) => buildPhotoUrl(p._id)),
    };
  };

  const existingBuildings = await Building.countDocuments({ tenantId: admin.tenantId });
  if (existingBuildings > 0) {
    await Building.updateMany(
      { tenantId: admin.tenantId, province_code: '79', ward_code: '79-04' },
      { $set: { ward_code: '25747', ward_name: 'Phường Thủ Dầu Một' } }
    );

    // Ensure existing demo rooms get MongoDB photoIds if they don't have any yet
    if (seededPhotos.length > 0) {
      const existingRooms = await Room.find({ tenantId: admin.tenantId }).sort({ floor: 1, roomCode: 1 });
      for (let i = 0; i < existingRooms.length; i += 1) {
        const rm = existingRooms[i];
        if (!rm.photoIds || rm.photoIds.length === 0) {
          const gal = pickGallery([
            i % seededPhotos.length,
            (i + 1) % seededPhotos.length,
            (i + 2) % seededPhotos.length,
          ]);
          rm.photoIds = gal.photoIds;
          rm.images = gal.images;
          if (!rm.defaultDeposit) rm.defaultDeposit = rm.base_price;
          if (!rm.description) {
            rm.description = `Căn hộ ${rm.roomCode} hoàn thiện nội thất gỗ cao cấp, ánh sáng tự nhiên và khóa thẻ từ an ninh.`;
          }
          await rm.save();
        }
      }
      console.log('[Seed] Attached MongoDB photos to existing demo rooms.');
    }
    return;
  }

  const b1 = await Building.create({
    tenantId: admin.tenantId,
    name: 'canho.com Signature — Thủ Dầu Một',
    address: '168 Đại lộ Bình Dương, Phường Thủ Dầu Một',
    province_code: '79',
    province_name: 'TP. Hồ Chí Minh',
    ward_code: '25747',
    ward_name: 'Phường Thủ Dầu Một',
    location: { type: 'Point', coordinates: [106.6525, 10.9804] },
    totalFloors: 3,
    primaryManagerId: manager._id,
    pricingConfig: {
      electricityPrice: toDecimal128(3500),
      waterPrice: toDecimal128(20000),
      managementFee: toDecimal128(150000),
      parkingFeeMotorbike: toDecimal128(120000),
      parkingFeeCar: toDecimal128(1200000),
      lateFeeDailyRate: toDecimal128(50000),
    },
    commissionConfig: {
      defaultCommissionRate: toDecimal128(5),
      managerCashLimit: toDecimal128(50000000),
      cashRemitDeadlineHours: 24,
    },
  });

  manager.assignedBuildings = [b1._id];
  await manager.save();

  const gal1 = pickGallery([0, 1, 2]);
  const gal2 = pickGallery([2, 3, 4]);
  const gal3 = pickGallery([3, 4, 5]);
  const gal4 = pickGallery([1, 5]);

  const rooms = await Room.insertMany([
    {
      tenantId: admin.tenantId,
      building_id: b1._id,
      roomCode: 'P101',
      floor: 1,
      area: 36,
      maxOccupants: 2,
      base_price: toDecimal128(6500000),
      defaultDeposit: toDecimal128(6500000),
      proposedPrice: toDecimal128(6500000),
      status: 'occupied',
      approvalStatus: 'approved',
      approvedBy: admin._id,
      approvedAt: new Date(),
      isPublished: true,
      ...gal1,
      description: 'Căn hộ 1 phòng ngủ, bàn ăn đá cẩm thạch & tủ bếp gỗ sang trọng.',
      amenities: ['Điều hòa', 'Nóng lạnh', 'Ban công gỗ', 'Bếp từ'],
      assets: [
        { name: 'Máy lạnh Inverter', quantity: 1, condition: 'Mới', value: toDecimal128(9000000) },
        { name: 'Giường gỗ Trầm', quantity: 1, condition: 'Tốt', value: toDecimal128(6000000) },
      ],
      keysAndCards: { mechanicalKeys: 2, keyCards: 2 },
    },
    {
      tenantId: admin.tenantId,
      building_id: b1._id,
      roomCode: 'P102',
      floor: 1,
      area: 32,
      maxOccupants: 2,
      base_price: toDecimal128(5800000),
      defaultDeposit: toDecimal128(5800000),
      proposedPrice: toDecimal128(5800000),
      status: 'available',
      approvalStatus: 'approved',
      approvedBy: admin._id,
      approvedAt: new Date(),
      isPublished: true,
      ...gal2,
      description: 'Căn hộ sáng thoáng cửa kính ban công, đầy đủ tủ lạnh, bếp gỗ & bàn ăn 4 ghế.',
      amenities: ['Điều hòa', 'Nóng lạnh', 'Tủ quần áo', 'Tủ lạnh'],
      keysAndCards: { mechanicalKeys: 2, keyCards: 2 },
    },
    {
      tenantId: admin.tenantId,
      building_id: b1._id,
      roomCode: 'P201',
      floor: 2,
      area: 42,
      maxOccupants: 3,
      base_price: toDecimal128(7900000),
      defaultDeposit: toDecimal128(7900000),
      proposedPrice: toDecimal128(7900000),
      status: 'available',
      approvalStatus: 'approved',
      approvedBy: admin._id,
      approvedAt: new Date(),
      isPublished: true,
      ...gal3,
      description: 'Căn hộ góc Neo-Chinese Luxury view hoàng hôn rộng rãi, sofa phòng khách chuẩn 5 sao.',
      amenities: ['Điều hòa', 'Máy giặt riêng', 'Ban công', 'Sofa'],
      keysAndCards: { mechanicalKeys: 2, keyCards: 3 },
    },
    {
      tenantId: admin.tenantId,
      building_id: b1._id,
      roomCode: 'P202',
      floor: 2,
      area: 30,
      maxOccupants: 2,
      base_price: toDecimal128(5200000),
      defaultDeposit: toDecimal128(5200000),
      proposedPrice: toDecimal128(5200000),
      status: 'pending_approval',
      approvalStatus: 'pending',
      isPublished: false,
      ...gal4,
      description: 'Studio ấm cúng tông gỗ sồi tự nhiên, đang chờ Admin duyệt lên sàn.',
      amenities: ['Điều hòa', 'Nóng lạnh'],
    },
  ]);

  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const contract = await Contract.create({
    tenantId: admin.tenantId,
    building_id: b1._id,
    room_id: rooms[0]._id,
    user_id: residentUser._id,
    contractCode: 'HD-2026-0001',
    occupants: [
      {
        fullName: residentUser.fullName,
        phone: residentUser.phone,
        idCard: residentUser.idCard,
        isPrimary: true,
      },
    ],
    vehicles: [{ type: 'motorbike', plateNumber: '61B1-88999' }],
    monthlyRent: toDecimal128(6500000),
    discountAmount: toDecimal128(0),
    depositAmount: toDecimal128(6500000),
    pricingSnapshot: b1.pricingConfig,
    commissionRateSnapshot: toDecimal128(5),
    startDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
    endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    signedAt: new Date(now.getFullYear(), now.getMonth() - 3, 1),
    signatureText: residentUser.fullName,
    handover: { elecInitial: 100, waterInitial: 10, keysGiven: 2, cardsGiven: 2, handedOverAt: new Date() },
    status: 'active',
  });

  const prevTotal = roundMoney(100 * 3500 + 8 * 20000 + 6500000 + 150000 + 120000);
  const invPrev = await Invoice.create({
    tenantId: admin.tenantId,
    building_id: b1._id,
    room_id: rooms[0]._id,
    contract_id: contract._id,
    user_id: residentUser._id,
    invoiceCode: `INV-${prevMonth.replace('-', '')}-P101`,
    billing_month: prevMonth,
    dueDate: new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 5),
    elecOld: 100,
    elecNew: 200,
    elecPrice: toDecimal128(3500),
    waterOld: 10,
    waterNew: 18,
    waterPrice: toDecimal128(20000),
    roomFee: toDecimal128(6500000),
    managementFee: toDecimal128(150000),
    parkingFee: toDecimal128(120000),
    totalAmount: toDecimal128(prevTotal),
    paidAmount: toDecimal128(prevTotal),
    remainingAmount: toDecimal128(0),
    status: 'paid',
    paidAt: new Date(),
  });

  const payPrev = await Payment.create({
    tenantId: admin.tenantId,
    building_id: b1._id,
    invoice_id: invPrev._id,
    user_id: residentUser._id,
    transactionCode: 'PAY-DEMO-0001',
    method: 'qr_transfer',
    expectedAmount: toDecimal128(prevTotal),
    amount: toDecimal128(prevTotal),
    discrepancyType: 'exact',
    confirmedBy: admin._id,
    status: 'confirmed',
  });

  await Commission.create({
    tenantId: admin.tenantId,
    building_id: b1._id,
    manager_id: manager._id,
    invoice_id: invPrev._id,
    payment_id: payPrev._id,
    period: prevMonth,
    roomFeeCollected: toDecimal128(6500000),
    commissionRate: toDecimal128(5),
    commissionAmount: toDecimal128(325000),
    status: 'pending_approval',
  });

  await AuditLog.create({
    tenantId: admin.tenantId,
    building_id: b1._id,
    actorId: admin._id,
    actorName: admin.fullName,
    actorRole: 'admin',
    actorSubRole: 'super_admin',
    action: 'SEED_WORKSPACE',
    targetModel: 'Building',
    targetId: b1._id,
    reason: `Khởi tạo dữ liệu mẫu kỳ ${currMonth}`,
  });

  console.log('[Seed] Demo accounts ready:');
  console.log('  - Admin:   admin@canho.com / Admin@123456');
  console.log('  - Manager: manager@canho.com / Manager@123456');
  console.log('  - Cư dân:  cudan@canho.com / Cudan@123456');
}

async function run() {
  const initOnly = process.argv.includes('--init-only');
  await connectDB(MONGODB_URI);
  await syncAllModels();
  await seed34Divisions();
  const seededPhotos = await seedRoomPhotosFromEnvDir();
  if (!initOnly) {
    await seedDemoData(seededPhotos);
  }
  await mongoose.disconnect();
  console.log('[Seed] Done.');
}

run().catch(async (err) => {
  console.error('[Seed] Error:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
