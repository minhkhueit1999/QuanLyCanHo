import RoomPhoto from '../models/RoomPhoto.js';
import Room from '../models/Room.js';
import { isValidObjectId } from '../config/db.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export function buildPhotoUrl(photoId) {
  return `/api/v1/rooms/photos/${photoId}`;
}

/**
 * GET /api/v1/rooms/photos/library
 * Protected by authenticate + buildingScopeGuard.
 * Lists pre-seeded DB photo library + photos uploaded inside current tenant/building.
 */
export const getPhotoLibrary = asyncHandler(async (req, res) => {
  const photos = await RoomPhoto.find({
    $or: [
      { isSeedLibrary: true },
      { tenantId: req.user.tenantId, building_id: req.buildingId },
    ],
  })
    .select('_id filename title contentType size isSeedLibrary room_id createdAt')
    .sort({ isSeedLibrary: -1, createdAt: 1 })
    .lean();

  res.status(200).json({
    success: true,
    data: photos.map((p) => ({
      ...p,
      url: buildPhotoUrl(p._id),
    })),
  });
});

/**
 * GET /api/v1/rooms/photos/:photoId
 * Streams binary image Buffer directly from MongoDB with proper Content-Type and Cache-Control.
 */
export const getRoomPhotoById = asyncHandler(async (req, res) => {
  const { photoId } = req.params;
  if (!isValidObjectId(photoId)) {
    throw new AppError('Mã ảnh phòng không hợp lệ', 400);
  }

  const photo = await RoomPhoto.findOne({ _id: photoId });
  if (!photo) {
    throw new AppError('Không tìm thấy ảnh phòng trong cơ sở dữ liệu', 404);
  }

  res.set({
    'Content-Type': photo.contentType,
    'Content-Length': photo.size,
    'Cache-Control': 'public, max-age=86400',
    'Content-Disposition': `inline; filename="${encodeURIComponent(photo.filename)}"`,
  });

  res.status(200).send(photo.data);
});

/**
 * POST /api/v1/rooms/photos/upload
 * Protected by authenticate + buildingScopeGuard.
 * Stores base64/data-URL image Buffer directly into MongoDB room_photos collection
 * and optionally attaches it to a room inside req.buildingId.
 */
export const uploadRoomPhoto = asyncHandler(async (req, res) => {
  const { filename = 'room-photo.jpg', contentType, base64Data, title = '', room_id = null } =
    req.body;

  if (!base64Data || typeof base64Data !== 'string') {
    throw new AppError('Thiếu dữ liệu ảnh (base64Data)', 400);
  }

  let detectedMime = contentType ? String(contentType).toLowerCase().trim() : 'image/jpeg';
  let rawBase64 = base64Data.trim();

  const dataUrlMatch = rawBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    detectedMime = dataUrlMatch[1].toLowerCase();
    rawBase64 = dataUrlMatch[2];
  }

  if (!ALLOWED_TYPES.includes(detectedMime)) {
    throw new AppError('Định dạng ảnh không được hỗ trợ (chỉ nhận JPEG, PNG, WebP)', 400);
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) {
    throw new AppError('Kích thước ảnh không hợp lệ (tối đa 5MB)', 400);
  }

  let targetRoom = null;
  if (room_id) {
    if (!isValidObjectId(room_id)) throw new AppError('Mã phòng không hợp lệ', 400);
    targetRoom = await Room.findOne({
      _id: room_id,
      tenantId: req.user.tenantId,
      building_id: req.buildingId,
    });
    if (!targetRoom) {
      throw new AppError('Không tìm thấy phòng trong tòa nhà hiện tại', 404);
    }
  }

  const photo = await RoomPhoto.create({
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    room_id: targetRoom ? targetRoom._id : null,
    filename: String(filename).trim().slice(0, 120),
    title: String(title || filename).trim().slice(0, 140),
    contentType: detectedMime === 'image/jpg' ? 'image/jpeg' : detectedMime,
    size: buffer.length,
    data: buffer,
    isSeedLibrary: false,
    uploadedBy: req.user._id,
  });

  const url = buildPhotoUrl(photo._id);

  if (targetRoom) {
    targetRoom.photoIds = [...(targetRoom.photoIds || []), photo._id];
    targetRoom.images = [...(targetRoom.images || []), url];
    await targetRoom.save();
  }

  res.status(201).json({
    success: true,
    message: 'Đã tải ảnh phòng lên MongoDB thành công',
    data: {
      _id: photo._id,
      filename: photo.filename,
      title: photo.title,
      contentType: photo.contentType,
      size: photo.size,
      url,
    },
  });
});

/**
 * POST /api/v1/rooms/:id/photos/attach
 * Attaches selected MongoDB RoomPhoto IDs (from library or building uploads) to a room.
 */
export const attachPhotosToRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { photoIds = [] } = req.body;
  if (!isValidObjectId(id)) throw new AppError('Mã phòng không hợp lệ', 400);
  if (!Array.isArray(photoIds)) throw new AppError('photoIds phải là mảng', 400);

  const room = await Room.findOne({
    _id: id,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
  });
  if (!room) throw new AppError('Không tìm thấy phòng trong tòa nhà', 404);

  const validIds = photoIds.filter(isValidObjectId);
  const ownedOrSeedPhotos = await RoomPhoto.find({
    _id: { $in: validIds },
    $or: [
      { isSeedLibrary: true },
      { tenantId: req.user.tenantId, building_id: req.buildingId },
    ],
  })
    .select('_id')
    .lean();

  const verifiedIds = ownedOrSeedPhotos.map((p) => p._id);
  room.photoIds = verifiedIds;
  room.images = verifiedIds.map((pId) => buildPhotoUrl(pId));
  await room.save();

  res.status(200).json({
    success: true,
    message: `Đã cập nhật ${verifiedIds.length} ảnh cho phòng ${room.roomCode}`,
    data: room,
  });
});

/**
 * DELETE /api/v1/rooms/photos/:photoId
 * Deletes a tenant-uploaded photo strictly scoped by tenantId + building_id.
 */
export const deleteRoomPhoto = asyncHandler(async (req, res) => {
  const { photoId } = req.params;
  if (!isValidObjectId(photoId)) throw new AppError('Mã ảnh không hợp lệ', 400);

  const deleted = await RoomPhoto.findOneAndDelete({
    _id: photoId,
    tenantId: req.user.tenantId,
    building_id: req.buildingId,
    isSeedLibrary: false,
  });

  if (!deleted) {
    throw new AppError('Không tìm thấy ảnh hoặc không có quyền xóa ảnh mẫu hệ thống', 404);
  }

  const url = buildPhotoUrl(photoId);
  await Room.updateMany(
    { tenantId: req.user.tenantId, building_id: req.buildingId },
    { $pull: { photoIds: deleted._id, images: url } }
  );

  res.status(200).json({
    success: true,
    message: 'Đã xóa ảnh khỏi MongoDB',
  });
});
