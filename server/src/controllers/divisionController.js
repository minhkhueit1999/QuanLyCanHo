import AdminDivision from '../models/AdminDivision.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/v1/divisions
 * Lists 34 Vietnamese provinces/cities with wards and legacy_aliases support.
 * Example: ?q=Bình Dương returns TP. Hồ Chí Minh with matching wards!
 */
export const getDivisions = asyncHandler(async (req, res) => {
  const { q, region } = req.query;
  const filter = {};

  if (region && ['Bắc', 'Trung', 'Nam'].includes(String(region))) {
    filter.region = String(region);
  }

  if (q && String(q).trim()) {
    const regex = new RegExp(escapeRegex(String(q).trim()), 'i');
    filter.$or = [
      { admin_code: regex },
      { name: regex },
      { legacy_aliases: regex },
      { 'wards.name': regex },
      { 'wards.legacy_aliases': regex },
    ];
  }

  const divisions = await AdminDivision.find(filter).sort({ admin_code: 1 }).lean();

  res.status(200).json({
    success: true,
    total: divisions.length,
    data: divisions,
  });
});
