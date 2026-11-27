import Room from '../models/Room.js';
import RoomPhoto from '../models/RoomPhoto.js';
import Contract from '../models/Contract.js';
import Deposit from '../models/Deposit.js';
import { isValidObjectId } from '../config/db.js';
import { decToNumber, toDecimal128 } from '../utils/decimal.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { recordAuditLog } from '../middlewares/auditHelper.js';
import { buildPhotoUrl } from './roomPhotoController.js';

function normalizeList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter(Boolean);
  return String(val)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * GET /api/v1/rooms
 * Building-scoped list of rooms with active contract & held deposit attached.
 */
export const getRooms = asyncHandler(async (req, res) => {
  const { floor, status, approvalStatus, search } = req.query;

  const filter = {
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  };

  if (floor && floor !== 'ALL') {
    const f = Number(floor);
    if (!Number.isInteger(f) || f < 1) throw new AppError('Số tầng không hợp lệ', 400);
    filter.floor = f;
  }
  if (status && status !== 'ALL') {
    filter.status = String(status);
  }
  if (approvalStatus && approvalStatus !== 'ALL') {
    filter.approvalStatus = String(approvalStatus);
  }

  const [rooms, activeContracts, heldDeposits] = await Promise.all([
    Room.find(filter).sort({ floor: 1, roomCode: 1 }).lean(),
    Contract.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      status: { $in: ['active', 'checkout_requested'] },
    })
      .select('room_id contractCode occupants endDate status monthlyRent')
      .lean(),
    Deposit.find({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      status: { $in: ['pending_payment', 'payment_verifying', 'held'] },
    })
      .populate({ path: 'user_id', select: 'fullName phone' })
      .lean(),
  ]);

  const contractMap = new Map(activeContracts.map((c) => [c.room_id.toString(), c]));
  const depositMap = new Map(heldDeposits.map((d) => [d.room_id.toString(), d]));

  let enriched = rooms.map((r) => ({
    ...r,
    base_price: decToNumber(r.base_price),
    defaultDeposit:
      r.defaultDeposit !== null && r.defaultDeposit !== undefined
        ? decToNumber(r.defaultDeposit)
        : decToNumber(r.base_price),
    proposedPrice: r.proposedPrice !== null ? decToNumber(r.proposedPrice) : null,
    discountLimit: decToNumber(r.discountLimit),
    activeContract: contractMap.get(r._id.toString()) || null,
    activeDeposit: depositMap.get(r._id.toString()) || null,
  }));

  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    enriched = enriched.filter(
      (r) =>
        r.roomCode.toLowerCase().includes(q) ||
        (r.activeContract?.occupants || []).some(
          (o) => o.fullName.toLowerCase().includes(q) || o.phone.includes(q)
        )
    );
  }

  res.status(200).json({
    success: true,
    data: enriched,
  });
});

/**
 * POST /api/v1/rooms
 * Manager proposes room/assets/keys/price -> status 'pending_approval'.
 * Admin can optionally auto-approve & publish immediately!
 */
export const createRoom = asyncHandler(async (req, res) => {
  const {
    roomCode,
    floor,
    area,
    maxOccupants = 2,
    base_price,
    defaultDeposit,
    discountLimit = 500000,
    amenities = [],
    images = [],
    photoIds = [],
    description = '',
    assets = [],
    keysAndCards = { mechanicalKeys: 2, keyCards: 2, note: '' },
    note = '',
    publishNow = false,
  } = req.body;

  if (!roomCode || !String(roomCode).trim()) throw new AppError('Mã phòng không được để trống', 400);

  const isAdminAutoPublish = req.user.role === 'admin' && Boolean(publishNow);
  const priceDec = toDecimal128(base_price);

  let resolvedPhotoIds = [];
  let resolvedImages = normalizeList(images);
  if (Array.isArray(photoIds) && photoIds.length > 0) {
    const validIds = photoIds.filter(isValidObjectId);
    const matchedPhotos = await RoomPhoto.find({
      _id: { $in: validIds },
      $or: [
        { isSeedLibrary: true },
        { tenantId: req.user.tenantId, building_id: req.buildingId },
      ],
    })
      .select('_id')
      .lean();
    resolvedPhotoIds = matchedPhotos.map((p) => p._id);
    resolvedImages = [...new Set([...resolvedPhotoIds.map((pId) => buildPhotoUrl(pId)), ...resolvedImages])];
  }

  const room = await Room.create({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    roomCode: String(roomCode).trim().toUpperCase(),
    floor: Math.max(1, Number(floor) || 1),
    area: Math.max(1, Number(area) || 25),
    maxOccupants: Math.max(1, Number(maxOccupants) || 2),
    base_price: priceDec,
    defaultDeposit: defaultDeposit !== undefined && defaultDeposit !== '' ? toDecimal128(defaultDeposit) : priceDec,
    proposedPrice: priceDec,
    discountLimit: toDecimal128(discountLimit),
    status: isAdminAutoPublish ? 'available' : 'pending_approval',
    approvalStatus: isAdminAutoPublish ? 'approved' : 'pending',
    approvedBy: isAdminAutoPublish ? req.user._id : null,
    approvedAt: isAdminAutoPublish ? new Date() : null,
    isPublished: isAdminAutoPublish,
    amenities: normalizeList(amenities),
    photoIds: resolvedPhotoIds,
    images: resolvedImages,
    description: String(description || '').trim(),
    assets: Array.isArray(assets)
      ? assets.map((a) => ({
          name: String(a.name || '').trim(),
          quantity: Number(a.quantity) || 1,
          condition: a.condition || 'Tốt',
          value: toDecimal128(a.value || 0),
        }))
      : [],
    keysAndCards: {
      mechanicalKeys: Number(keysAndCards.mechanicalKeys ?? 2),
      keyCards: Number(keysAndCards.keyCards ?? 2),
      note: String(keysAndCards.note || ''),
    },
    note: String(note || '').trim(),
  });

  res.status(201).json({
    success: true,
    message: isAdminAutoPublish
      ? `Đã tạo và đăng sàn phòng ${room.roomCode}`
      : `Đã tạo đề xuất phòng ${room.roomCode}, chờ Admin duyệt lên sàn`,
    data: room,
  });
});

/**
 * POST /api/v1/rooms/batch
 * Batch generate rooms per floor (e.g. P101-P105).
 */
export const batchCreateRooms = asyncHandler(async (req, res) => {
  const {
    floor = 1,
    prefix = 'P',
    startNumber = 1,
    count = 5,
    area = 30,
    maxOccupants = 2,
    base_price,
    amenities = [],
    publishNow = false,
  } = req.body;

  const parsedFloor = Math.max(1, Number(floor));
  const parsedStart = Math.max(1, Number(startNumber));
  const parsedCount = Math.min(50, Math.max(1, Number(count)));
  const cleanPrefix = String(prefix || 'P').trim().toUpperCase();

  const codes = [];
  for (let i = 0; i < parsedCount; i += 1) {
    const num = parsedStart < 100 ? parsedFloor * 100 + (parsedStart + i) : parsedStart + i;
    codes.push(`${cleanPrefix}${num}`);
  }

  const existing = await Room.find({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    roomCode: { $in: codes },
  })
    .select('roomCode')
    .lean();

  const existingSet = new Set(existing.map((e) => e.roomCode));
  const isAdminAutoPublish = req.user.role === 'admin' && Boolean(publishNow);
  const priceDec = toDecimal128(base_price || 5000000);

  const docs = codes
    .filter((c) => !existingSet.has(c))
    .map((code) => ({
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
      roomCode: code,
      floor: parsedFloor,
      area: Math.max(1, Number(area) || 30),
      maxOccupants: Math.max(1, Number(maxOccupants) || 2),
      base_price: priceDec,
      proposedPrice: priceDec,
      status: isAdminAutoPublish ? 'available' : 'pending_approval',
      approvalStatus: isAdminAutoPublish ? 'approved' : 'pending',
      approvedBy: isAdminAutoPublish ? req.user._id : null,
      approvedAt: isAdminAutoPublish ? new Date() : null,
      isPublished: isAdminAutoPublish,
      amenities: normalizeList(amenities),
    }));

  if (docs.length === 0) {
    throw new AppError('Tất cả mã phòng dự kiến đã tồn tại', 409);
  }

  const created = await Room.insertMany(docs);
  res.status(201).json({
    success: true,
    message: `Đã khởi tạo ${created.length} phòng tầng ${parsedFloor}`,
    data: { createdCount: created.length, skippedCodes: [...existingSet], rooms: created },
  });
});

/**
 * PUT /api/v1/rooms/:id
 * Updates room details, assets, keysAndCards, or maintenance toggle.
 */
export const updateRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phòng không hợp lệ', 400);

  const room = await Room.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!room) throw new AppError('Không tìm thấy phòng trong tòa nhà', 404);

  const {
    roomCode,
    floor,
    area,
    maxOccupants,
    base_price,
    defaultDeposit,
    discountLimit,
    status,
    amenities,
    images,
    photoIds,
    description,
    assets,
    keysAndCards,
    note,
  } = req.body;

  if (roomCode !== undefined) room.roomCode = String(roomCode).trim().toUpperCase();
  if (floor !== undefined) room.floor = Math.max(1, Number(floor) || 1);
  if (area !== undefined) room.area = Math.max(1, Number(area) || 1);
  if (maxOccupants !== undefined) room.maxOccupants = Math.max(1, Number(maxOccupants) || 1);
  if (amenities !== undefined) room.amenities = normalizeList(amenities);
  if (description !== undefined) room.description = String(description).trim();
  if (defaultDeposit !== undefined && defaultDeposit !== '') {
    room.defaultDeposit = toDecimal128(defaultDeposit);
  }
  if (Array.isArray(photoIds)) {
    const validIds = photoIds.filter(isValidObjectId);
    const matchedPhotos = await RoomPhoto.find({
      _id: { $in: validIds },
      $or: [
        { isSeedLibrary: true },
        { tenantId: req.user.tenantId, building_id: req.buildingId },
      ],
    })
      .select('_id')
      .lean();
    room.photoIds = matchedPhotos.map((p) => p._id);
    room.images = room.photoIds.map((pId) => buildPhotoUrl(pId));
  } else if (images !== undefined) {
    room.images = normalizeList(images);
  }
  if (note !== undefined) room.note = String(note).trim();

  if (base_price !== undefined) {
    if (req.user.role === 'admin') {
      room.base_price = toDecimal128(base_price);
      room.proposedPrice = toDecimal128(base_price);
    } else {
      room.proposedPrice = toDecimal128(base_price);
    }
  }
  if (discountLimit !== undefined && req.user.role === 'admin') {
    room.discountLimit = toDecimal128(discountLimit);
  }
  if (Array.isArray(assets)) {
    room.assets = assets.map((a) => ({
      name: String(a.name || '').trim(),
      quantity: Number(a.quantity) || 1,
      condition: a.condition || 'Tốt',
      value: toDecimal128(a.value || 0),
    }));
  }
  if (keysAndCards) {
    room.keysAndCards = {
      mechanicalKeys: Number(keysAndCards.mechanicalKeys ?? room.keysAndCards?.mechanicalKeys ?? 2),
      keyCards: Number(keysAndCards.keyCards ?? room.keysAndCards?.keyCards ?? 2),
      note: String(keysAndCards.note ?? room.keysAndCards?.note ?? ''),
    };
  }
  if (status && ['available', 'maintenance'].includes(status)) {
    if (room.status === 'occupied' || room.status === 'reserved') {
      throw new AppError('Phòng đang có hợp đồng hoặc phiếu cọc giữ chỗ, không thể đổi trực tiếp', 400);
    }
    if (status === 'available' && room.approvalStatus !== 'approved') {
      throw new AppError('Phòng chưa được Admin duyệt lên sàn', 400);
    }
    room.status = status;
  }

  await room.save();
  res.status(200).json({
    success: true,
    message: `Cập nhật phòng ${room.roomCode} thành công`,
    data: room,
  });
});

/**
 * PATCH /api/v1/rooms/:id/approve
 * Admin only (super_admin or operations). Approves proposed room & publishes to marketplace.
 */
export const approveRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phòng không hợp lệ', 400);

  const room = await Room.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!room) throw new AppError('Không tìm thấy phòng', 404);

  const { approvedPrice, approvalNote = '' } = req.body;
  const before = {
    status: room.status,
    approvalStatus: room.approvalStatus,
    base_price: decToNumber(room.base_price),
  };

  if (approvedPrice !== undefined && approvedPrice !== '') {
    room.base_price = toDecimal128(approvedPrice);
  } else if (room.proposedPrice !== null) {
    room.base_price = room.proposedPrice;
  }

  room.approvalStatus = 'approved';
  room.approvedBy = req.user._id;
  room.approvedAt = new Date();
  room.approvalNote = String(approvalNote || '');
  room.isPublished = true;
  if (['draft', 'pending_approval'].includes(room.status)) {
    room.status = 'available';
  }

  await room.save();

  await recordAuditLog({
    req,
    tenantId: req.user.tenantId,
    buildingId: req.buildingId,
    action: 'APPROVE_ROOM',
    targetModel: 'Room',
    targetId: room._id,
    reason: approvalNote || 'Duyệt phòng lên sàn canho.com',
    beforeState: before,
    afterState: {
      status: room.status,
      approvalStatus: room.approvalStatus,
      base_price: decToNumber(room.base_price),
    },
  });

  res.status(200).json({
    success: true,
    message: `Đã duyệt và mở cho thuê phòng ${room.roomCode}`,
    data: room,
  });
});

/**
 * DELETE /api/v1/rooms/:id
 */
export const deleteRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw new AppError('Mã phòng không hợp lệ', 400);

  const room = await Room.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!room) throw new AppError('Không tìm thấy phòng', 404);
  if (['occupied', 'reserved'].includes(room.status)) {
    throw new AppError('Không thể xóa phòng đang có hợp đồng hoặc phiếu cọc', 400);
  }

  await Room.deleteOne({ _id: room._id, tenantId: req.user.tenantId, building_id: req.buildingId });
  res.status(200).json({ success: true, message: `Đã xóa phòng ${room.roomCode}` });
});
