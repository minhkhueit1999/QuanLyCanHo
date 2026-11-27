<template>
  <Teleport to="body">
    <div
      v-if="open && room"
      class="no-print fixed inset-0 z-50 flex justify-end bg-wood-deep/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      :aria-label="`Chi tiết phòng ${room.roomCode}`"
      @click.self="$emit('close')"
    >
      <div class="flex h-full w-full max-w-2xl flex-col border-l border-gold/40 bg-surface shadow-canho">
        <!-- Drawer Wood Header -->
        <div class="flex items-start justify-between border-b border-gold/30 bg-wood-deep px-6 py-5 text-white">
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h2 class="font-serif text-2xl font-bold text-white">Phòng {{ room.roomCode }}</h2>
              <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="statusMeta.badgeClass">
                {{ statusMeta.label }}
              </span>
              <span
                v-if="mode === 'workspace' && room.approvalStatus === 'pending'"
                class="rounded-full border border-gold bg-gold/20 px-2.5 py-0.5 text-[11px] font-semibold text-gold"
              >
                Chờ duyệt lên sàn
              </span>
            </div>
            <p class="mt-1 text-xs text-white/80 tabular-nums">
              Tầng {{ room.floor }} • {{ room.area }} m² • Tối đa {{ room.maxOccupants }} người •
              <strong class="text-gold">{{ formatCurrency(room.base_price) }}/tháng</strong>
            </p>
          </div>

          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-wood hover:text-white cursor-pointer"
            aria-label="Đóng chi tiết phòng"
            @click="$emit('close')"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 space-y-5 overflow-y-auto p-6">
          <div
            v-if="errorMsg"
            class="rounded-xs border border-primary/40 bg-primary-tint px-4 py-3 text-xs font-medium text-primary"
            role="alert"
          >
            {{ errorMsg }}
          </div>

          <!-- Interactive Multi-Photo Gallery -->
          <section class="space-y-2.5">
            <div class="relative aspect-[16/10] w-full overflow-hidden rounded-sm border border-hairline bg-surface-alt">
              <img
                v-if="photos.length > 0"
                :src="resolveMediaUrl(photos[activePhotoIndex])"
                :alt="`Phòng ${room.roomCode} - ảnh ${activePhotoIndex + 1}`"
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full w-full flex-col items-center justify-center gap-2 text-muted">
                <Building2 class="h-10 w-10 text-gold/70" />
                <span class="font-serif text-sm">canho.com • Chưa cập nhật hình ảnh</span>
              </div>

              <template v-if="photos.length > 1">
                <button
                  type="button"
                  class="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/50 bg-wood-deep/75 text-white transition hover:bg-primary cursor-pointer"
                  aria-label="Ảnh trước"
                  @click="prevPhoto"
                >
                  <ChevronLeft class="h-5 w-5" />
                </button>
                <button
                  type="button"
                  class="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gold/50 bg-wood-deep/75 text-white transition hover:bg-primary cursor-pointer"
                  aria-label="Ảnh tiếp theo"
                  @click="nextPhoto"
                >
                  <ChevronRight class="h-5 w-5" />
                </button>
                <span
                  class="absolute bottom-3 right-3 rounded-full bg-wood-deep/80 px-3 py-1 text-xs font-medium text-white tabular-nums"
                >
                  {{ activePhotoIndex + 1 }} / {{ photos.length }}
                </span>
              </template>
            </div>

            <!-- Thumbnails -->
            <div v-if="photos.length > 1" class="flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="(photoUrl, idx) in photos"
                :key="`${photoUrl}-${idx}`"
                type="button"
                class="h-14 w-20 shrink-0 overflow-hidden rounded-xs border transition cursor-pointer"
                :class="
                  idx === activePhotoIndex
                    ? 'border-primary ring-2 ring-gold'
                    : 'border-hairline opacity-75 hover:opacity-100'
                "
                @click="activePhotoIndex = idx"
              >
                <img :src="resolveMediaUrl(photoUrl)" :alt="`Thumbnail ${idx + 1}`" class="h-full w-full object-cover" />
              </button>
            </div>
          </section>

          <!-- Pricing & Deposit Summary Card -->
          <section class="grid grid-cols-2 gap-3 rounded-xs border border-gold/50 bg-gold-tint/35 p-4 sm:grid-cols-3">
            <div>
              <span class="block text-[11px] font-medium text-muted">Giá thuê hàng tháng</span>
              <strong class="font-serif text-lg font-bold text-primary tabular-nums">
                {{ formatCurrency(room.base_price) }}
              </strong>
            </div>
            <div>
              <span class="block text-[11px] font-medium text-muted">Tiền cọc mặc định</span>
              <strong class="font-serif text-lg font-bold text-ink tabular-nums">
                {{ formatCurrency(room.defaultDeposit ?? room.base_price) }}
              </strong>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <span class="block text-[11px] font-medium text-muted">Chìa khóa &amp; Thẻ từ</span>
              <strong class="text-sm font-semibold text-ink tabular-nums">
                {{ room.keysAndCards?.mechanicalKeys ?? 2 }} cơ • {{ room.keysAndCards?.keyCards ?? 2 }} thẻ từ
              </strong>
            </div>
          </section>

          <!-- Description & Building Location (Especially Explore Mode) -->
          <section v-if="room.building || room.description" class="card-canho space-y-3 p-4">
            <div v-if="room.building">
              <h3 class="font-serif text-base font-bold text-ink">{{ room.building.name }}</h3>
              <p class="mt-1 flex items-start gap-1.5 text-xs text-muted">
                <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {{ room.building.address }}
                  <template v-if="room.building.ward_name || room.building.province_name">
                    ({{ room.building.ward_name }}, {{ room.building.province_name }})
                  </template>
                </span>
              </p>

              <!-- Utility tariff preview if building pricingConfig is returned -->
              <div
                v-if="room.building.pricingConfig"
                class="mt-3 grid grid-cols-2 gap-2 rounded-xs border border-hairline bg-canvas p-3 text-xs sm:grid-cols-4 tabular-nums"
              >
                <div>
                  <span class="block text-[11px] text-muted">Giá điện</span>
                  <strong class="text-ink">{{ formatCurrency(room.building.pricingConfig.electricityPrice) }}/kWh</strong>
                </div>
                <div>
                  <span class="block text-[11px] text-muted">Giá nước</span>
                  <strong class="text-ink">{{ formatCurrency(room.building.pricingConfig.waterPrice) }}/m³</strong>
                </div>
                <div>
                  <span class="block text-[11px] text-muted">Internet</span>
                  <strong class="text-ink">{{ formatCurrency(room.building.pricingConfig.internetFee) }}/tháng</strong>
                </div>
                <div>
                  <span class="block text-[11px] text-muted">Gửi xe</span>
                  <strong class="text-ink">{{ formatCurrency(room.building.pricingConfig.parkingFee) }}/xe</strong>
                </div>
              </div>
            </div>

            <div v-if="room.description" class="border-t border-hairline pt-3">
              <h4 class="text-xs font-semibold text-ink">Mô tả không gian</h4>
              <p class="mt-1 text-xs leading-relaxed text-muted">{{ room.description }}</p>
            </div>
          </section>

          <!-- Workspace Mode: Admin Approval Banner -->
          <div
            v-if="mode === 'workspace' && room.approvalStatus === 'pending'"
            class="card-gold neo-lattice bg-gold-tint/50 p-4"
          >
            <p class="text-sm font-bold text-ink">Phòng đang chờ Admin duyệt lên sàn canho.com</p>
            <p class="mt-1 text-xs text-muted tabular-nums">
              Giá đề xuất: <strong>{{ formatCurrency(room.proposedPrice || room.base_price) }}</strong>
            </p>
            <div v-if="authStore.isAdmin" class="mt-3 flex flex-wrap items-center gap-2">
              <label for="approve-price" class="sr-only">Giá duyệt lên sàn</label>
              <input id="approve-price" v-model.number="approvedPrice" type="number" step="100000" class="input-canho min-h-[44px] w-44 tabular-nums" />
              <button type="button" class="btn-primary-pill min-h-[44px] px-4 py-2 text-xs" :disabled="submitting" @click="approveRoom">
                <CheckCircle2 class="h-3.5 w-3.5" />
                <span>Duyệt &amp; Đăng sàn</span>
              </button>
            </div>
          </div>

          <!-- Workspace Mode: Photo Manager in MongoDB -->
          <div v-if="mode === 'workspace'" class="card-canho p-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
              <div>
                <h3 class="font-serif text-sm font-bold text-ink">Thư viện ảnh MongoDB của phòng</h3>
                <p class="text-[11px] text-muted">Tải ảnh mới hoặc tick chọn từ kho ảnh 6 mẫu sẵn có</p>
              </div>
              <button
                type="button"
                class="btn-secondary-pill min-h-[40px] px-3.5 py-1.5 text-xs"
                @click="managingPhotos = !managingPhotos"
              >
                <Images class="h-3.5 w-3.5 text-primary" />
                <span>{{ managingPhotos ? 'Thu gọn kho ảnh' : 'Quản lý / Upload ảnh' }}</span>
              </button>
            </div>

            <div v-if="managingPhotos" class="mt-4 space-y-3">
              <RoomPhotoPicker
                v-model="selectedPhotoIds"
                :room-id="room._id"
                @uploaded="emitUpdated"
                @deleted="emitUpdated"
              />
              <div class="flex justify-end border-t border-hairline pt-3">
                <button
                  type="button"
                  class="btn-primary-pill min-h-[44px] px-4 py-2 text-xs"
                  :disabled="savingPhotos"
                  @click="saveSelectedPhotos"
                >
                  <Loader2 v-if="savingPhotos" class="h-3.5 w-3.5 animate-spin" />
                  <span>Lưu danh sách {{ selectedPhotoIds.length }} ảnh cho phòng</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Assets, Keys & Edit Form -->
          <div class="card-canho p-4">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <h3 class="font-serif text-sm font-bold text-ink">Tài sản, Chìa khóa &amp; Tiện nghi</h3>
              <div v-if="mode === 'workspace'" class="flex items-center gap-2">
                <button type="button" class="btn-secondary-pill min-h-[40px] px-3.5 py-1 text-xs" @click="editing = !editing">
                  {{ editing ? 'Hủy sửa' : 'Chỉnh sửa thông số' }}
                </button>
                <button
                  v-if="!['occupied', 'reserved'].includes(room.status)"
                  type="button"
                  class="min-h-[40px] rounded-full border border-primary/40 px-3.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white cursor-pointer"
                  @click="deleteRoom"
                >
                  Xóa phòng
                </button>
              </div>
            </div>

            <form v-if="mode === 'workspace' && editing" class="mt-4 space-y-3" @submit.prevent="saveRoomEdits">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label for="rm-edit-price" class="mb-1 block text-xs font-semibold">
                    {{ authStore.isAdmin ? 'Giá thuê (VNĐ)' : 'Đề xuất giá (VNĐ)' }}
                  </label>
                  <input id="rm-edit-price" v-model.number="editForm.base_price" type="number" step="100000" class="input-canho min-h-[44px] tabular-nums" />
                </div>
                <div>
                  <label for="rm-edit-deposit" class="mb-1 block text-xs font-semibold">Tiền cọc mặc định (VNĐ)</label>
                  <input id="rm-edit-deposit" v-model.number="editForm.defaultDeposit" type="number" step="100000" class="input-canho min-h-[44px] tabular-nums" />
                </div>
                <div>
                  <label for="rm-edit-occ" class="mb-1 block text-xs font-semibold">Số người tối đa</label>
                  <input id="rm-edit-occ" v-model.number="editForm.maxOccupants" type="number" min="1" class="input-canho min-h-[44px] tabular-nums" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="rm-edit-keys" class="mb-1 block text-xs font-semibold">Chìa cơ</label>
                    <input id="rm-edit-keys" v-model.number="editForm.mechanicalKeys" type="number" min="0" class="input-canho min-h-[44px] tabular-nums" />
                  </div>
                  <div>
                    <label for="rm-edit-cards" class="mb-1 block text-xs font-semibold">Thẻ từ</label>
                    <input id="rm-edit-cards" v-model.number="editForm.keyCards" type="number" min="0" class="input-canho min-h-[44px] tabular-nums" />
                  </div>
                </div>
              </div>
              <div>
                <label for="rm-edit-desc" class="mb-1 block text-xs font-semibold">Mô tả chi tiết căn hộ</label>
                <textarea id="rm-edit-desc" v-model="editForm.description" rows="2" class="input-canho"></textarea>
              </div>
              <div>
                <label for="rm-edit-amen" class="mb-1 block text-xs font-semibold">Tiện nghi (cách nhau dấu phẩy)</label>
                <input id="rm-edit-amen" v-model="editForm.amenitiesText" type="text" class="input-canho min-h-[44px]" />
              </div>
              <div>
                <label for="rm-edit-assets" class="mb-1 block text-xs font-semibold">Tài sản (Tên:SL, VD: Điều hòa:1, Giường gỗ:1)</label>
                <input id="rm-edit-assets" v-model="editForm.assetsText" type="text" class="input-canho min-h-[44px]" />
              </div>
              <button type="submit" class="btn-primary-pill min-h-[44px] w-full py-2 text-xs" :disabled="submitting">
                Lưu thay đổi phòng
              </button>
            </form>

            <div v-else class="mt-3 space-y-3 text-xs">
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="a in room.amenities || []"
                  :key="a"
                  class="rounded-full border border-hairline bg-canvas px-2.5 py-1 text-ink"
                >
                  {{ a }}
                </span>
                <span v-if="!room.amenities?.length" class="text-muted">Chưa cập nhật tiện nghi.</span>
              </div>

              <div v-if="room.assets && room.assets.length > 0" class="border-t border-hairline pt-2.5">
                <p class="font-semibold text-ink">Danh mục tài sản bàn giao:</p>
                <ul class="mt-1.5 grid grid-cols-1 gap-1 text-muted sm:grid-cols-2">
                  <li v-for="(asset, idx) in room.assets" :key="idx">
                    • {{ asset.name }} (SL: {{ asset.quantity }} • {{ asset.condition }})
                  </li>
                </ul>
              </div>

              <div
                v-if="mode === 'workspace' && ['available', 'maintenance'].includes(room.status)"
                class="flex items-center justify-between border-t border-hairline pt-3"
              >
                <span class="text-muted">Trạng thái bảo trì:</span>
                <button type="button" class="btn-secondary-pill min-h-[40px] px-3.5 py-1 text-xs" :disabled="submitting" @click="toggleMaintenance">
                  {{ room.status === 'maintenance' ? 'Mở lại Trống' : 'Chuyển Bảo trì' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Active Contract / Deposit Links in Workspace Mode -->
          <div v-if="mode === 'workspace' && room.activeContract" class="card-canho p-4">
            <h3 class="font-serif text-sm font-bold text-primary">Hợp đồng đang hiệu lực</h3>
            <p class="mt-1 text-xs text-muted">
              Mã HĐ: <strong class="text-ink">{{ room.activeContract.contractCode }}</strong> • Hết hạn:
              {{ formatDate(room.activeContract.endDate) }}
            </p>
            <ul class="mt-2 space-y-1 text-xs text-ink">
              <li v-for="o in room.activeContract.occupants" :key="o.idCard">
                • {{ o.fullName }} ({{ o.phone }})
              </li>
            </ul>
            <router-link to="/contracts" class="btn-primary-pill mt-3 min-h-[44px] w-full py-2 text-xs">
              Quản lý Hợp đồng / Quyết toán trả phòng
            </router-link>
          </div>

          <div v-else-if="mode === 'workspace' && room.activeDeposit" class="card-gold bg-gold-tint/40 p-4">
            <h3 class="font-serif text-sm font-bold text-ink">Đang giữ chỗ đặt cọc</h3>
            <p class="mt-1 text-xs text-muted">
              Mã cọc: <strong>{{ room.activeDeposit.depositCode }}</strong> • Khách:
              <strong>{{ room.activeDeposit.user_id?.fullName }}</strong>
            </p>
            <router-link to="/deposits" class="btn-primary-pill mt-3 min-h-[44px] w-full py-2 text-xs">
              Xử lý Cọc giữ chỗ
            </router-link>
          </div>
        </div>

        <!-- Explore Sticky Booking/Deposit CTA Footer -->
        <div
          v-if="mode === 'explore'"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-alt/80 px-6 py-4"
        >
          <div>
            <span class="block text-[11px] text-muted">Tổng cọc giữ chỗ mặc định</span>
            <strong class="font-serif text-lg font-bold text-primary tabular-nums">
              {{ formatCurrency(room.defaultDeposit ?? room.base_price) }}
            </strong>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-secondary-pill min-h-[44px] px-4 py-2 text-xs" @click="$emit('book', room)">
              <Calendar class="h-3.5 w-3.5 text-primary" />
              <span>Đặt lịch xem</span>
            </button>
            <button type="button" class="btn-primary-pill min-h-[44px] px-5 py-2 text-xs" @click="$emit('deposit', room)">
              <BookmarkCheck class="h-3.5 w-3.5" />
              <span>Đặt cọc giữ chỗ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import {
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  Calendar,
  BookmarkCheck,
  Images,
  Loader2,
} from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, formatDate, resolveMediaUrl, ROOM_STATUS_META } from '@/utils/format';
import RoomPhotoPicker from '@/components/RoomPhotoPicker.vue';

const props = defineProps({
  open: Boolean,
  room: { type: Object, default: null },
  mode: {
    type: String,
    default: 'workspace',
    validator: (v) => ['explore', 'workspace'].includes(v),
  },
});

const emit = defineEmits(['close', 'updated', 'book', 'deposit']);
const authStore = useAuthStore();
const toastStore = useToastStore();

const editing = ref(false);
const managingPhotos = ref(false);
const submitting = ref(false);
const savingPhotos = ref(false);
const errorMsg = ref('');
const approvedPrice = ref(0);
const activePhotoIndex = ref(0);
const selectedPhotoIds = ref([]);

const editForm = reactive({
  base_price: 0,
  defaultDeposit: 0,
  maxOccupants: 2,
  mechanicalKeys: 2,
  keyCards: 2,
  description: '',
  amenitiesText: '',
  assetsText: '',
});

const statusMeta = computed(
  () => ROOM_STATUS_META[props.room?.status] || ROOM_STATUS_META.available
);

const photos = computed(() => {
  if (!props.room) return [];
  const urls = Array.isArray(props.room.images) ? props.room.images.filter(Boolean) : [];
  if (urls.length > 0) return urls;
  return Array.isArray(props.room.photoIds)
    ? props.room.photoIds.map((id) => `/api/v1/rooms/photos/${id}`)
    : [];
});

watch(
  () => props.room,
  (r) => {
    editing.value = false;
    managingPhotos.value = false;
    errorMsg.value = '';
    activePhotoIndex.value = 0;
    if (r) {
      approvedPrice.value = r.proposedPrice || r.base_price || 0;
      editForm.base_price = r.base_price || 0;
      editForm.defaultDeposit = r.defaultDeposit ?? r.base_price ?? 0;
      editForm.maxOccupants = r.maxOccupants || 2;
      editForm.mechanicalKeys = r.keysAndCards?.mechanicalKeys ?? 2;
      editForm.keyCards = r.keysAndCards?.keyCards ?? 2;
      editForm.description = r.description || '';
      editForm.amenitiesText = (r.amenities || []).join(', ');
      editForm.assetsText = (r.assets || []).map((a) => `${a.name}:${a.quantity}`).join(', ');
      selectedPhotoIds.value = (r.photoIds || []).map(String);
    }
  },
  { immediate: true }
);

function prevPhoto() {
  if (photos.value.length <= 1) return;
  activePhotoIndex.value = (activePhotoIndex.value - 1 + photos.value.length) % photos.value.length;
}

function nextPhoto() {
  if (photos.value.length <= 1) return;
  activePhotoIndex.value = (activePhotoIndex.value + 1) % photos.value.length;
}

function emitUpdated() {
  emit('updated');
}

async function saveSelectedPhotos() {
  savingPhotos.value = true;
  errorMsg.value = '';
  try {
    await api.post(`/rooms/${props.room._id}/photos/attach`, {
      photoIds: selectedPhotoIds.value,
    });
    toastStore.success(`Đã cập nhật ${selectedPhotoIds.value.length} ảnh trong MongoDB cho phòng ${props.room.roomCode}`);
    emit('updated');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    savingPhotos.value = false;
  }
}

async function approveRoom() {
  submitting.value = true;
  errorMsg.value = '';
  try {
    await api.patch(`/rooms/${props.room._id}/approve`, {
      approvedPrice: approvedPrice.value,
      approvalNote: 'Admin duyệt phòng lên sàn canho.com',
    });
    toastStore.success(`Đã duyệt phòng ${props.room.roomCode} lên sàn`);
    emit('updated');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}

async function saveRoomEdits() {
  submitting.value = true;
  errorMsg.value = '';
  try {
    const assets = editForm.assetsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, qty] = part.split(':');
        return { name: name.trim(), quantity: Number(qty) || 1, condition: 'Tốt' };
      });

    await api.put(`/rooms/${props.room._id}`, {
      base_price: editForm.base_price,
      defaultDeposit: editForm.defaultDeposit,
      maxOccupants: editForm.maxOccupants,
      description: editForm.description,
      amenities: editForm.amenitiesText,
      assets,
      keysAndCards: {
        mechanicalKeys: editForm.mechanicalKeys,
        keyCards: editForm.keyCards,
      },
    });
    toastStore.success('Đã cập nhật thông số phòng');
    editing.value = false;
    emit('updated');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}

async function toggleMaintenance() {
  submitting.value = true;
  try {
    const next = props.room.status === 'maintenance' ? 'available' : 'maintenance';
    await api.put(`/rooms/${props.room._id}`, { status: next });
    toastStore.success('Đã cập nhật trạng thái phòng');
    emit('updated');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}

async function deleteRoom() {
  submitting.value = true;
  try {
    await api.delete(`/rooms/${props.room._id}`);
    toastStore.success(`Đã xóa phòng ${props.room.roomCode}`);
    emit('updated');
    emit('close');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>
