import AdminDivision from '../models/AdminDivision.js';
import Building from '../models/Building.js';
import Room from '../models/Room.js';
import { isValidObjectId } from '../config/db.js';
import { AppError, asyncHandler } from '../middlewares/errorHandler.js';
import { decToNumber } from '../utils/decimal.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/v1/explore/rooms
 * Public & User discovery across approved published rooms.
 * Supports:
 * - province_code (34-province standard)
 * - search (matches building name, address, ward, or legacy_aliases like "Bình Dương")
 * - minPrice, maxPrice, minArea, floor
 * - lng, lat, radiusKm (GeoJSON 2dsphere radius search)
 */
export const exploreRooms = asyncHandler(async (req, res) => {
  const {
    province_code,
    ward_code,
    search,
    minPrice,
    maxPrice,
    minArea,
    amenities,
    lng,
    lat,
    radiusKm,
  } = req.query;

  const buildingFilter = {};

  if (province_code && String(province_code).trim()) {
    buildingFilter.province_code = String(province_code).trim();
  }
  if (ward_code && String(ward_code).trim()) {
    buildingFilter.ward_code = String(ward_code).trim();
  }

  if (search && String(search).trim()) {
    const keyword = String(search).trim();
    const regex = new RegExp(escapeRegex(keyword), 'i');

    const matchedDivisions = await AdminDivision.find({
      $or: [
        { name: regex },
        { legacy_aliases: regex },
        { 'wards.name': regex },
        { 'wards.legacy_aliases': regex },
      ],
    })
      .select('admin_code name legacy_aliases wards')
      .lean();

    const matchedProvinceCodes = matchedDivisions
      .filter(
        (d) =>
          regex.test(d.name) ||
          (d.legacy_aliases || []).some((alias) => regex.test(alias))
      )
      .map((d) => d.admin_code);
    const matchedWardCodes = [];
    for (const div of matchedDivisions) {
      for (const w of div.wards || []) {
        if (
          regex.test(w.name) ||
          (w.legacy_aliases || []).some((alias) => regex.test(alias))
        ) {
          matchedWardCodes.push(w.ward_code);
        }
      }
    }

    const searchClauses = [
      { name: regex },
      { address: regex },
      { province_name: regex },
      { ward_name: regex },
    ];
    if (matchedWardCodes.length > 0) {
      searchClauses.push({ ward_code: { $in: matchedWardCodes } });
    }
    if (matchedProvinceCodes.length > 0) {
      searchClauses.push({ province_code: { $in: matchedProvinceCodes } });
    }
    buildingFilter.$or = searchClauses;
  }

  if (lng !== undefined && lat !== undefined && radiusKm !== undefined) {
    const parsedLng = Number(lng);
    const parsedLat = Number(lat);
    const parsedRadius = Number(radiusKm);
    if (
      !Number.isNaN(parsedLng) &&
      !Number.isNaN(parsedLat) &&
      !Number.isNaN(parsedRadius) &&
      parsedRadius > 0
    ) {
      buildingFilter.location = {
        $geoWithin: {
          $centerSphere: [[parsedLng, parsedLat], parsedRadius / 6378.1],
        },
      };
    }
  }

  const matchedBuildings = await Building.find(buildingFilter).lean();
  if (matchedBuildings.length === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  const buildingIds = matchedBuildings.map((b) => b._id);
  const buildingMap = new Map(matchedBuildings.map((b) => [b._id.toString(), b]));

  const roomFilter = {
    building_id: { $in: buildingIds },
    isPublished: true,
    approvalStatus: 'approved',
    status: 'available',
  };

  if (minArea !== undefined && minArea !== '') {
    const val = Number(minArea);
    if (!Number.isNaN(val) && val > 0) roomFilter.area = { $gte: val };
  }
  if (amenities && String(amenities).trim()) {
    const reqAmenities = String(amenities)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (reqAmenities.length > 0) {
      roomFilter.amenities = { $all: reqAmenities.map((a) => new RegExp(escapeRegex(a), 'i')) };
    }
  }

  const rooms = await Room.find(roomFilter).sort({ createdAt: -1 }).lean();

  const minP = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
  const maxP = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;

  const results = rooms
    .map((r) => {
      const price = decToNumber(r.base_price);
      const b = buildingMap.get(r.building_id.toString());
      return {
        ...r,
        base_price: price,
        defaultDeposit:
          r.defaultDeposit !== null && r.defaultDeposit !== undefined
            ? decToNumber(r.defaultDeposit)
            : price,
        proposedPrice: r.proposedPrice !== null ? decToNumber(r.proposedPrice) : null,
        discountLimit: decToNumber(r.discountLimit),
        building: b
          ? {
              _id: b._id,
              name: b.name,
              address: b.address,
              province_code: b.province_code,
              province_name: b.province_name,
              ward_code: b.ward_code,
              ward_name: b.ward_name,
              location: b.location,
              pricingConfig: b.pricingConfig,
            }
          : null,
      };
    })
    .filter((r) => {
      if (minP !== null && !Number.isNaN(minP) && r.base_price < minP) return false;
      if (maxP !== null && !Number.isNaN(maxP) && r.base_price > maxP) return false;
      return true;
    });

  res.status(200).json({
    success: true,
    data: results,
  });
});

/**
 * GET /api/v1/explore/rooms/:id
 */
export const getExploreRoomDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError('Mã phòng không hợp lệ', 400);
  }

  const room = await Room.findOne({
    _id: id,
    isPublished: true,
    approvalStatus: 'approved',
  }).lean();

  if (!room) {
    throw new AppError('Không tìm thấy căn hộ đang mở cho thuê', 404);
  }

  const building = await Building.findOne({
    _id: room.building_id,
    tenantId: room.tenantId,
  }).lean();

  res.status(200).json({
    success: true,
    data: {
      ...room,
      base_price: decToNumber(room.base_price),
      defaultDeposit:
        room.defaultDeposit !== null && room.defaultDeposit !== undefined
          ? decToNumber(room.defaultDeposit)
          : decToNumber(room.base_price),
      discountLimit: decToNumber(room.discountLimit),
      building,
    },
  });
});
