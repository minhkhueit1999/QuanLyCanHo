<template>
  <div>
    <!-- Hero Search Banner -->
    <section class="wood-lattice-bg border-b border-gold/40 pb-10 pt-8 text-white">
      <div class="container-canho">
        <div class="max-w-2xl">
          <span class="inline-block rounded-full border border-gold/40 bg-gold/15 px-3.5 py-1 text-xs font-medium text-gold">
            canho.com • Không gian sống chuẩn mực
          </span>
          <h1 class="mt-2.5 font-serif text-3xl font-bold leading-tight text-white sm:text-5xl">
            Tìm căn hộ chuẩn mực tại 34 Tỉnh/Thành
          </h1>
          
        </div>

        <!-- Booking.com-Style Multi-Filter Search Box -->
        <form
          class="mt-6 space-y-2 rounded-xs border-2 border-gold bg-surface p-2.5 text-ink shadow-canho"
          @submit.prevent="fetchRooms"
        >
          <div class="grid grid-cols-1 gap-2 md:grid-cols-12">
            <div class="md:col-span-4">
              <label for="exp-search" class="sr-only">Tìm địa danh cũ/mới hoặc tòa nhà</label>
              <div class="relative">
                <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="exp-search"
                  v-model="filters.search"
                  type="text"
                  placeholder="Nhập 'Bình Dương', 'Vũng Tàu', tên tòa..."
                  class="input-canho min-h-[44px] pl-9"
                  @input="onSearchAliasCheck"
                />
              </div>
            </div>

            <div class="md:col-span-3">
              <label for="exp-prov" class="sr-only">Tỉnh/Thành phố (34 đơn vị)</label>
              <select id="exp-prov" v-model="filters.province_code" class="input-canho min-h-[44px]" @change="onProvinceSelect">
                <option value="">Tất cả 34 Tỉnh/Thành</option>
                <option v-for="d in workspaceStore.divisions" :key="d.admin_code" :value="d.admin_code">
                  {{ d.name }}
                </option>
              </select>
            </div>

            <div class="md:col-span-3">
              <label for="exp-ward" class="sr-only">Phường/Xã</label>
              <select id="exp-ward" v-model="filters.ward_code" class="input-canho min-h-[44px]" :disabled="!filters.province_code">
                <option value="">
                  {{ filters.province_code ? `Tất cả ${availableWards.length} Phường/Xã/Đặc khu` : 'Tất cả Phường/Xã' }}
                </option>
                <option v-for="w in availableWards" :key="w.ward_code" :value="w.ward_code">
                  {{ w.name }}
                </option>
              </select>
            </div>

            <div class="md:col-span-2">
              <button type="submit" class="btn-primary-pill min-h-[44px] h-full w-full py-2 text-sm">
                Tìm phòng
              </button>
            </div>
          </div>

          <!-- Secondary Filters Row -->
          <div class="grid grid-cols-2 gap-2 border-t border-hairline pt-2 md:grid-cols-12">
            <div class="md:col-span-3">
              <label for="exp-minp" class="sr-only">Giá tối thiểu</label>
              <input id="exp-minp" v-model="filters.minPrice" type="number" step="500000" placeholder="Giá từ (VNĐ)" class="input-canho py-1.5 text-xs tabular-nums" />
            </div>
            <div class="md:col-span-3">
              <label for="exp-maxp" class="sr-only">Giá tối đa</label>
              <input id="exp-maxp" v-model="filters.maxPrice" type="number" step="500000" placeholder="Giá đến (VNĐ)" class="input-canho py-1.5 text-xs tabular-nums" />
            </div>
            <div class="md:col-span-2">
              <label for="exp-area" class="sr-only">Diện tích tối thiểu</label>
              <input id="exp-area" v-model="filters.minArea" type="number" placeholder="Từ (m²)" class="input-canho py-1.5 text-xs tabular-nums" />
            </div>
            <div class="md:col-span-2">
              <label for="exp-amen" class="sr-only">Tiện ích</label>
              <input id="exp-amen" v-model="filters.amenities" type="text" placeholder="Tiện ích (Điều hòa...)" class="input-canho py-1.5 text-xs" />
            </div>
            <div class="md:col-span-2">
              <label for="exp-rad" class="sr-only">Bán kính GeoJSON</label>
              <select id="exp-rad" v-model="filters.radiusKm" class="input-canho py-1.5 text-xs">
                <option value="">Mọi khoảng cách</option>
                <option value="5">Bán kính 5 km</option>
                <option value="15">Bán kính 15 km</option>
                <option value="30">Bán kính 30 km</option>
              </select>
            </div>
          </div>

          <!-- Legacy Alias Suggestion Banner -->
          <div
            v-if="aliasHint"
            class="flex items-center justify-between rounded-xs border border-gold/50 bg-gold-tint px-3 py-1.5 text-xs text-ink"
          >
            <span>
              Gợi ý địa danh hành chính mới: Tìm <strong>"{{ filters.search }}"</strong> → ánh xạ tới
              <strong class="text-primary">{{ aliasHint.name }}</strong>
            </span>
            <button
              type="button"
              class="font-semibold text-primary underline cursor-pointer"
              @click="applyAliasDivision"
            >
              Lọc theo {{ aliasHint.name }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Results Grid -->
    <section class="container-canho py-8">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-serif text-2xl font-bold text-ink">
            Căn hộ đang mở cho thuê ({{ bookingBillingStore.exploreRooms.length }})
          </h2>
          <p class="text-xs text-muted">
            Toàn bộ phòng đã được Admin duyệt giá, tài sản và bàn giao chìa khóa minh bạch
          </p>
        </div>

        <button
          v-if="hasFilters"
          type="button"
          class="btn-secondary-pill min-h-[40px] px-4 py-1.5 text-xs"
          @click="resetFilters"
        >
          Xóa bộ lọc
        </button>
      </div>

      <div v-if="bookingBillingStore.loading" class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 6" :key="n" class="h-80 animate-pulse rounded-xs border border-hairline bg-surface"></div>
      </div>

      <div
        v-else-if="bookingBillingStore.exploreRooms.length === 0"
        class="card-canho neo-lattice p-10 text-center"
      >
        <Building2 class="mx-auto h-10 w-10 text-muted/60" />
        <p class="mt-3 font-serif text-lg font-bold text-ink">Không tìm thấy căn hộ trống phù hợp</p>
        <p class="mt-1 text-xs text-muted">
          Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm (ví dụ: "Bình Dương", "TP. Hồ Chí Minh").
        </p>
      </div>

      <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <RoomCard
          v-for="room in bookingBillingStore.exploreRooms"
          :key="room._id"
          mode="explore"
          :room="room"
          @detail="openDetail"
          @book="openBookingModal"
          @deposit="openDepositModal"
        />
      </div>
    </section>

    <!-- Room Detail Drawer (Explore Mode) -->
    <RoomDetailModal
      mode="explore"
      :open="detailModal.open"
      :room="detailModal.room"
      @close="detailModal.open = false"
      @book="openBookingModalFromDetail"
      @deposit="openDepositModalFromDetail"
    />

    <!-- Booking Modal -->
    <Teleport to="body">
      <div
        v-if="bookingModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="bookingModal.open = false"
      >
        <div class="card-gold neo-lattice w-full max-w-md p-6">
          <h3 class="font-serif text-xl font-bold text-ink">
            Đặt lịch xem Phòng {{ bookingModal.room?.roomCode }}
          </h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitBooking">
            <div>
              <label for="vb-name" class="mb-1 block text-xs font-semibold">Họ và tên</label>
              <input id="vb-name" v-model="bookingModal.visitorName" type="text" required class="input-canho min-h-[44px]" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="vb-phone" class="mb-1 block text-xs font-semibold">Số điện thoại</label>
                <input id="vb-phone" v-model="bookingModal.visitorPhone" type="tel" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="vb-type" class="mb-1 block text-xs font-semibold">Hình thức</label>
                <select id="vb-type" v-model="bookingModal.bookingType" class="input-canho min-h-[44px]">
                  <option value="in_person">Xem trực tiếp</option>
                  <option value="video_call">Video Call</option>
                </select>
              </div>
            </div>
            <div>
              <label for="vb-time" class="mb-1 block text-xs font-semibold">Ngày giờ hẹn</label>
              <input id="vb-time" v-model="bookingModal.scheduledAt" type="datetime-local" required class="input-canho min-h-[44px]" />
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill min-h-[44px]" @click="bookingModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill min-h-[44px]" :disabled="submitting">Xác nhận lịch hẹn</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Deposit Hold Modal -->
    <Teleport to="body">
      <div
        v-if="depositModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="depositModal.open = false"
      >
        <div class="card-gold neo-lattice w-full max-w-md p-6">
          <h3 class="font-serif text-xl font-bold text-ink">
            Đặt cọc giữ chỗ Phòng {{ depositModal.room?.roomCode }}
          </h3>
          <p class="mt-1 text-xs text-muted">
            Quét QR giữ chỗ 15 phút • Tiền mặt tại quầy giữ chỗ 24 giờ
          </p>
          <form class="mt-4 space-y-3" @submit.prevent="submitDeposit">
            <div>
              <label for="dep-amt" class="mb-1 block text-xs font-semibold">Số tiền cọc (VNĐ)</label>
              <input id="dep-amt" v-model.number="depositModal.amount" type="number" min="100000" step="100000" required class="input-canho min-h-[44px] tabular-nums" />
            </div>
            <div>
              <label for="dep-method" class="mb-1 block text-xs font-semibold">Phương thức</label>
              <select id="dep-method" v-model="depositModal.paymentMethod" class="input-canho min-h-[44px]">
                <option value="qr_transfer">Chuyển khoản QR (Giữ 15 phút)</option>
                <option value="cash">Tiền mặt tại quầy (Giữ 24 giờ)</option>
              </select>
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill min-h-[44px]" @click="depositModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill min-h-[44px]" :disabled="submitting">Đặt cọc giữ chỗ</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Building2 } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useBookingBillingStore } from '@/stores/bookingBilling';
import { useToastStore } from '@/stores/toast';
import RoomCard from '@/components/RoomCard.vue';
import RoomDetailModal from '@/components/RoomDetailModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const bookingBillingStore = useBookingBillingStore();
const toastStore = useToastStore();

const submitting = ref(false);
const aliasHint = ref(null);

const filters = reactive({
  search: '',
  province_code: '',
  ward_code: '',
  minPrice: '',
  maxPrice: '',
  minArea: '',
  amenities: '',
  radiusKm: '',
});

const detailModal = reactive({
  open: false,
  room: null,
});

const availableWards = computed(() => {
  const div = workspaceStore.divisions.find((d) => d.admin_code === filters.province_code);
  return div ? div.wards || [] : [];
});

const hasFilters = computed(
  () =>
    filters.search ||
    filters.province_code ||
    filters.ward_code ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.minArea ||
    filters.amenities ||
    filters.radiusKm
);

const bookingModal = reactive({
  open: false,
  room: null,
  visitorName: '',
  visitorPhone: '',
  bookingType: 'in_person',
  scheduledAt: '',
});

const depositModal = reactive({
  open: false,
  room: null,
  amount: 0,
  paymentMethod: 'qr_transfer',
});

function onProvinceSelect() {
  filters.ward_code = '';
  fetchRooms();
}

function onSearchAliasCheck() {
  const q = filters.search.trim().toLowerCase();
  if (!q || q.length < 2) {
    aliasHint.value = null;
    return;
  }
  const matched = workspaceStore.divisions.find((d) =>
    (d.legacy_aliases || []).some((a) => a.toLowerCase().includes(q))
  );
  aliasHint.value = matched || null;
}

function applyAliasDivision() {
  if (!aliasHint.value) return;
  filters.province_code = aliasHint.value.admin_code;
  filters.ward_code = '';
  aliasHint.value = null;
  fetchRooms();
}

async function fetchRooms() {
  try {
    const params = {
      search: filters.search || undefined,
      province_code: filters.province_code || undefined,
      ward_code: filters.ward_code || undefined,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      minArea: filters.minArea || undefined,
      amenities: filters.amenities || undefined,
    };

    if (filters.radiusKm) {
      const div =
        workspaceStore.divisions.find((d) => d.admin_code === filters.province_code) ||
        aliasHint.value ||
        workspaceStore.divisions.find((d) => d.admin_code === '79');
      if (div?.center?.coordinates?.length === 2) {
        params.lng = div.center.coordinates[0];
        params.lat = div.center.coordinates[1];
        params.radiusKm = filters.radiusKm;
      }
    }

    await bookingBillingStore.searchPublicRooms(params);
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function resetFilters() {
  Object.assign(filters, {
    search: '',
    province_code: '',
    ward_code: '',
    minPrice: '',
    maxPrice: '',
    minArea: '',
    amenities: '',
    radiusKm: '',
  });
  aliasHint.value = null;
  fetchRooms();
}

async function openDetail(room) {
  detailModal.room = room;
  detailModal.open = true;
  try {
    const res = await api.get(`/explore/rooms/${room._id}`);
    if (res.data?.data) {
      detailModal.room = res.data.data;
    }
  } catch {
    // Keep card snapshot if background refresh fails
  }
}

function openBookingModalFromDetail(room) {
  detailModal.open = false;
  openBookingModal(room);
}

function openDepositModalFromDetail(room) {
  detailModal.open = false;
  openDepositModal(room);
}

function openBookingModal(room) {
  bookingModal.room = room;
  bookingModal.visitorName = authStore.user?.fullName || '';
  bookingModal.visitorPhone = authStore.user?.phone || '';
  bookingModal.bookingType = 'in_person';
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  tomorrow.setMinutes(0, 0, 0);
  bookingModal.scheduledAt = tomorrow.toISOString().slice(0, 16);
  bookingModal.open = true;
}

async function submitBooking() {
  submitting.value = true;
  try {
    await api.post('/bookings', {
      room_id: bookingModal.room._id,
      visitorName: bookingModal.visitorName,
      visitorPhone: bookingModal.visitorPhone,
      bookingType: bookingModal.bookingType,
      scheduledAt: bookingModal.scheduledAt,
    });
    toastStore.success('Đặt lịch xem phòng thành công!');
    bookingModal.open = false;
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

function openDepositModal(room) {
  if (!authStore.isAuthenticated) {
    toastStore.info('Vui lòng đăng nhập tài khoản Khách thuê để đặt cọc giữ chỗ');
    router.push('/login');
    return;
  }
  depositModal.room = room;
  depositModal.amount = room.defaultDeposit ?? room.base_price;
  depositModal.paymentMethod = 'qr_transfer';
  depositModal.open = true;
}

async function submitDeposit() {
  submitting.value = true;
  try {
    const res = await api.post('/deposits', {
      room_id: depositModal.room._id,
      amount: depositModal.amount,
      paymentMethod: depositModal.paymentMethod,
    });
    toastStore.success(res.data.message);
    depositModal.open = false;
    await fetchRooms();
    router.push('/portal');
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([workspaceStore.fetchDivisions(), fetchRooms()]);
});
</script>
