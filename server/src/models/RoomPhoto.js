import mongoose from 'mongoose';

const roomPhotoSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    building_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Building',
      default: null,
      index: true,
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    contentType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    data: {
      type: Buffer,
      required: true,
    },
    isSeedLibrary: {
      type: Boolean,
      default: false,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

roomPhotoSchema.index({ tenantId: 1, building_id: 1, room_id: 1 });
roomPhotoSchema.index({ isSeedLibrary: 1, createdAt: 1 });

const RoomPhoto = mongoose.model('RoomPhoto', roomPhotoSchema, 'room_photos');
export default RoomPhoto;
