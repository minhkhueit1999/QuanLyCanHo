import mongoose from 'mongoose';

const wardSchema = new mongoose.Schema(
  {
    ward_code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    legacy_aliases: [{ type: String, trim: true }],
  },
  { _id: false }
);

const adminDivisionSchema = new mongoose.Schema(
  {
    admin_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['city', 'province'],
      required: true,
    },
    region: {
      type: String,
      enum: ['Bắc', 'Trung', 'Nam'],
      required: true,
    },
    legacy_aliases: [{ type: String, trim: true }],
    wards: [wardSchema],
    center: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [106.7009, 10.7769],
      },
    },
  },
  { timestamps: true }
);

adminDivisionSchema.index({ center: '2dsphere' });
adminDivisionSchema.index({ name: 1 });
adminDivisionSchema.index({ legacy_aliases: 1 });
adminDivisionSchema.index({ 'wards.ward_code': 1 });
adminDivisionSchema.index({ 'wards.name': 1 });

const AdminDivision = mongoose.model('AdminDivision', adminDivisionSchema, 'admin_divisions');
export default AdminDivision;
