<template>
  <div class="space-y-6">
    <!-- Filter & Action Toolbar -->
    <div class="card-canho neo-lattice p-4 sm:p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2.5">
          <div>
            <label for="rm-floor" class="sr-only">Lọc tầng</label>
            <select id="rm-floor" v-model="selectedFloor" class="input-canho min-h-[40px] py-2 text-xs">
              <option value="ALL">Tất cả tầng</option>
              <option v-for="fl in floorsList" :key="fl" :value="fl">Tầng {{ fl }}</option>
            </select>
          </div>

          <div class="inline-flex flex-wrap rounded-full border border-hairline bg-canvas p-1">
            <button
              v-for="tab in statusTabs"
              :key="tab.value"
              type="button"
              class="rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer"
              :class="selectedStatus === tab.value ? 'bg-primary text-white' : 'text-muted hover:text-ink'"
              @click="selectedStatus = tab.value"
            >
              {{ tab.label }} ({{ countStatus(tab.value) }})
            </button>
          </div>

          <div class="relative">
            <label for="rm-search" class="sr-only">Tìm phòng</label>
            <Search class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input id="rm-search" v-model="search" type="search" placeholder="Tìm mã phòng, cư dân..." class="input-canho min-h-[40px] w-48 py-1.5 pl-8 text-xs" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-secondary-pill min-h-[44px] px-4 py-2 text-xs" @click="batchOpen = true">
            <Layers class="h-3.5 w-3.5 text-primary" />
            <span>Tạo nhanh theo tầng</span>
          </button>
          <button type="button" class="btn-primary-pill min-h-[44px] px-4 py-2 text-xs" @click="openCreateModal">
            <Plus class="h-3.5 w-3.5" />
            <span>Thêm / Đề xuất phòng</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="n in 6" :key="n" class="h-72 animate-pulse rounded-xs border border-hairline bg-surface"></div>
    </div>

    <div v-else-if="groupedFloors.length === 0" class="card-canho neo-lattice p-10 text-center">
      <Building2 class="mx-auto h-10 w-10 text-muted/60" />
      <p class="mt-2 font-serif text-lg font-bold">Chưa có phòng nào phù hợp</p>
    </div>

    <!-- Visual Floor Plan Grouped Showcase -->
    <div v-else class="space-y-6">
      <section v-for="grp in groupedFloors" :key="grp.floor" class="card-canho neo-lattice p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
          <div class="flex items-center gap-2.5">
            <span class="rounded-full bg-wood-deep px-3.5 py-1 font-serif text-xs font-bold text-gold">
              Tầng {{ grp.floor }}
            </span>
            <span class="text-xs text-muted">{{ grp.rooms.length }} căn hộ</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-status-available"></span>Trống</span>
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-status-occupied"></span>Đang thuê</span>
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-status-reserved"></span>Giữ chỗ / Bảo trì</span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <RoomCard
            v-for="room in grp.rooms"
            :key="room._id"
            mode="workspace"
            :room="room"
            @detail="openDetail"
          />
        </div>
      </section>
    </div>

    <!-- Single Create Room Modal with MongoDB Photo Library Picker & Upload -->
    <Teleport to="body">
      <div
        v-if="createOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="createOpen = false"
      >
        <div class="card-gold neo-lattice max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-serif text-xl font-bold text-ink">
                {{ authStore.isAdmin ? 'Thêm phòng mới' : 'Đề xuất phòng mới lên sàn' }}
              </h2>
              <p class="mt-0.5 text-xs text-muted">
                Chọn ảnh phòng trực tiếp từ kho MongoDB hoặc tải ảnh mới từ máy tính
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-muted hover:bg-surface-alt hover:text-ink cursor-pointer"
              aria-label="Đóng"
              @click="createOpen = false"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <form class="mt-4 space-y-4" @submit.prevent="submitCreate">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label for="cr-code" class="mb-1 block text-xs font-semibold">Mã phòng</label>
                <input id="cr-code" v-model="createForm.roomCode" type="text" required placeholder="P101" class="input-canho min-h-[44px] uppercase" />
              </div>
              <div>
                <label for="cr-floor" class="mb-1 block text-xs font-semibold">Tầng</label>
                <input id="cr-floor" v-model.number="createForm.floor" type="number" min="1" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="cr-area" class="mb-1 block text-xs font-semibold">Diện tích (m²)</label>
                <input id="cr-area" v-model.number="createForm.area" type="number" min="1" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="cr-occ" class="mb-1 block text-xs font-semibold">Tối đa (người)</label>
                <input id="cr-occ" v-model.number="createForm.maxOccupants" type="number" min="1" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label for="cr-price" class="mb-1 block text-xs font-semibold">Giá thuê đề xuất / niêm yết (VNĐ)</label>
                <input id="cr-price" v-model.number="createForm.base_price" type="number" min="0" step="100000" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="cr-deposit" class="mb-1 block text-xs font-semibold">Tiền cọc mặc định (VNĐ)</label>
                <input id="cr-deposit" v-model.number="createForm.defaultDeposit" type="number" min="0" step="100000" class="input-canho min-h-[44px] tabular-nums" />
              </div>
            </div>

            <div>
              <label for="cr-desc" class="mb-1 block text-xs font-semibold">Mô tả nổi bật (hướng nắng, nội thất, ưu điểm)</label>
              <textarea
                id="cr-desc"
                v-model="createForm.description"
                rows="2"
                placeholder="Căn hộ thiết kế ánh sáng tự nhiên, đầy đủ bếp và nội thất gỗ..."
                class="input-canho"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label for="cr-amen" class="mb-1 block text-xs font-semibold">Tiện nghi (cách nhau dấu phẩy)</label>
                <input id="cr-amen" v-model="createForm.amenitiesText" type="text" class="input-canho min-h-[44px]" />
              </div>
              <div>
                <label for="cr-assets" class="mb-1 block text-xs font-semibold">Tài sản (VD: Điều hòa:1, Giường gỗ:1)</label>
                <input id="cr-assets" v-model="createForm.assetsText" type="text" class="input-canho min-h-[44px]" />
              </div>
            </div>

            <!-- MongoDB Photo Picker & Upload -->
            <div class="rounded-xs border border-hairline bg-canvas/60 p-3.5">
              <RoomPhotoPicker v-if="createOpen" v-model="createForm.photoIds" />
            </div>

            <label v-if="authStore.isAdmin" class="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
              <input v-model="createForm.publishNow" type="checkbox" class="h-4 w-4 accent-primary" />
              <span>Duyệt &amp; Đăng sàn canho.com ngay lập tức</span>
            </label>

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" class="btn-secondary-pill min-h-[44px]" @click="createOpen = false">Hủy</button>
              <button type="submit" class="btn-primary-pill min-h-[44px]" :disabled="submitting">Lưu phòng</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Batch Create Modal -->
    <Teleport to="body">
      <div
        v-if="batchOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="batchOpen = false"
      >
        <div class="card-gold neo-lattice w-full max-w-md p-6">
          <h2 class="font-serif text-xl font-bold text-ink">Tạo nhanh phòng theo Tầng</h2>
          <form class="mt-4 space-y-3" @submit.prevent="submitBatch">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="bt-floor" class="mb-1 block text-xs font-semibold">Tầng</label>
                <input id="bt-floor" v-model.number="batchForm.floor" type="number" min="1" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="bt-prefix" class="mb-1 block text-xs font-semibold">Tiền tố</label>
                <input id="bt-prefix" v-model="batchForm.prefix" type="text" class="input-canho min-h-[44px] uppercase" />
              </div>
              <div>
                <label for="bt-start" class="mb-1 block text-xs font-semibold">Số bắt đầu</label>
                <input id="bt-start" v-model.number="batchForm.startNumber" type="number" min="1" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="bt-count" class="mb-1 block text-xs font-semibold">Số lượng</label>
                <input id="bt-count" v-model.number="batchForm.count" type="number" min="1" max="50" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="bt-area" class="mb-1 block text-xs font-semibold">Diện tích (m²)</label>
                <input id="bt-area" v-model.number="batchForm.area" type="number" min="1" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
              <div>
                <label for="bt-price" class="mb-1 block text-xs font-semibold">Giá thuê (VNĐ)</label>
                <input id="bt-price" v-model.number="batchForm.base_price" type="number" min="0" step="100000" required class="input-canho min-h-[44px] tabular-nums" />
              </div>
            </div>
            <label v-if="authStore.isAdmin" class="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
              <input v-model="batchForm.publishNow" type="checkbox" class="h-4 w-4 accent-primary" />
              <span>Duyệt &amp; Đăng sàn canho.com ngay</span>
            </label>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill min-h-[44px]" @click="batchOpen = false">Hủy</button>
              <button type="submit" class="btn-primary-pill min-h-[44px]" :disabled="submitting">Tạo {{ batchForm.count }} phòng</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <RoomDetailModal
      mode="workspace"
      :open="drawerOpen"
      :room="selectedRoom"
      @close="drawerOpen = false"
      @updated="fetchRooms"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Search, Layers, Plus, Building2, X } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToastStore } from '@/stores/toast';
import RoomCard from '@/components/RoomCard.vue';
import RoomDetailModal from '@/components/RoomDetailModal.vue';
import RoomPhotoPicker from '@/components/RoomPhotoPicker.vue';

const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const toastStore = useToastStore();

const rooms = ref([]);
const loading = ref(false);
const submitting = ref(false);
const selectedFloor = ref('ALL');
const selectedStatus = ref('ALL');
const search = ref('');

const createOpen = ref(false);
const batchOpen = ref(false);
const drawerOpen = ref(false);
const selectedRoomId = ref('');

const createForm = reactive({
  roomCode: '',
  floor: 1,
  area: 32,
  maxOccupants: 2,
  base_price: 5500000,
  defaultDeposit: 5500000,
  description: '',
  photoIds: [],
  amenitiesText: 'Điều hòa, Nóng lạnh, Ban công',
  assetsText: 'Máy lạnh Inverter:1, Giường gỗ:1',
  publishNow: true,
});

const batchForm = reactive({
  floor: 1,
  prefix: 'P',
  startNumber: 1,
  count: 5,
  area: 30,
  base_price: 5000000,
  publishNow: true,
});

const statusTabs = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'available', label: 'Trống' },
  { value: 'occupied', label: 'Đang thuê' },
  { value: 'reserved', label: 'Giữ chỗ' },
  { value: 'pending_approval', label: 'Chờ duyệt' },
  { value: 'maintenance', label: 'Bảo trì' },
];

const selectedRoom = computed(() => rooms.value.find((r) => r._id === selectedRoomId.value) || null);

const floorsList = computed(() => {
  const s = new Set();
  for (let i = 1; i <= (workspaceStore.currentBuilding?.totalFloors || 1); i += 1) s.add(i);
  for (const r of rooms.value) s.add(r.floor);
  return Array.from(s).sort((a, b) => a - b);
});

const filteredRooms = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rooms.value.filter((r) => {
    if (selectedFloor.value !== 'ALL' && r.floor !== Number(selectedFloor.value)) return false;
    if (selectedStatus.value !== 'ALL' && r.status !== selectedStatus.value) return false;
    if (q) {
      const mCode = r.roomCode.toLowerCase().includes(q);
      const mOcc = (r.activeContract?.occupants || []).some((o) => o.fullName.toLowerCase().includes(q));
      if (!mCode && !mOcc) return false;
    }
    return true;
  });
});

const groupedFloors = computed(() => {
  const map = new Map();
  for (const r of filteredRooms.value) {
    if (!map.has(r.floor)) map.set(r.floor, []);
    map.get(r.floor).push(r);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([floor, list]) => ({ floor, rooms: list }));
});

function countStatus(st) {
  if (st === 'ALL') return rooms.value.length;
  return rooms.value.filter((r) => r.status === st).length;
}

function openCreateModal() {
  createForm.roomCode = '';
  createForm.description = '';
  createForm.photoIds = [];
  createForm.defaultDeposit = createForm.base_price;
  createOpen.value = true;
}

async function fetchRooms() {
  if (!workspaceStore.currentBuildingId) return;
  loading.value = true;
  try {
    const res = await api.get('/rooms');
    rooms.value = res.data.data || [];
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  submitting.value = true;
  try {
    const assets = createForm.assetsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, qty] = part.split(':');
        return { name: name.trim(), quantity: Number(qty) || 1, condition: 'Tốt' };
      });

    const res = await api.post('/rooms', {
      roomCode: createForm.roomCode,
      floor: createForm.floor,
      area: createForm.area,
      maxOccupants: createForm.maxOccupants,
      base_price: createForm.base_price,
      defaultDeposit: createForm.defaultDeposit || createForm.base_price,
      description: createForm.description,
      photoIds: createForm.photoIds,
      amenities: createForm.amenitiesText,
      assets,
      publishNow: authStore.isAdmin && createForm.publishNow,
    });
    toastStore.success(res.data.message);
    createOpen.value = false;
    createForm.roomCode = '';
    createForm.photoIds = [];
    await fetchRooms();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

async function submitBatch() {
  submitting.value = true;
  try {
    const res = await api.post('/rooms/batch', {
      ...batchForm,
      publishNow: authStore.isAdmin && batchForm.publishNow,
    });
    toastStore.success(res.data.message);
    batchOpen.value = false;
    await fetchRooms();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

function openDetail(room) {
  selectedRoomId.value = room._id;
  drawerOpen.value = true;
}

watch(
  () => workspaceStore.currentBuildingId,
  (id) => {
    if (id) {
      drawerOpen.value = false;
      fetchRooms();
    }
  },
  { immediate: true }
);
</script>
