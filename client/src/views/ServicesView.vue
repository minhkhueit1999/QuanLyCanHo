<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
    <div class="card-canho neo-lattice p-5 lg:col-span-4">
      <h2 class="font-serif text-lg font-bold text-ink">Tạo phiếu Dịch vụ / Bảo trì</h2>
      <p class="mt-1 text-xs text-muted">
        Phân định rõ trách nhiệm chi phí: Hạ tầng (Công ty) vs Cư dân &amp; Sự cố khẩn cấp 24h
      </p>
      <form class="mt-4 space-y-3" @submit.prevent="createTicket">
        <div>
          <label for="sv-room" class="mb-1 block text-xs font-semibold">Phòng</label>
          <select id="sv-room" v-model="form.room_id" required class="input-canho">
            <option v-for="r in rooms" :key="r._id" :value="r._id">Phòng {{ r.roomCode }}</option>
          </select>
        </div>
        <div>
          <label for="sv-type" class="mb-1 block text-xs font-semibold">Phân loại &amp; Trách nhiệm chi phí</label>
          <select id="sv-type" v-model="form.ticketType" class="input-canho">
            <option value="add_on_service">Dịch vụ đi kèm (tenant chịu phí)</option>
            <option value="maintenance_infra">Bảo trì hạ tầng (company chịu phí)</option>
            <option value="maintenance_resident_fault">Hư hỏng do cư dân (tenant chịu phí)</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="sv-prio" class="mb-1 block text-xs font-semibold">Mức ưu tiên</label>
            <select id="sv-prio" v-model="form.priority" class="input-canho">
              <option value="normal">Bình thường</option>
              <option value="urgent">Khẩn cấp (24h giải trình)</option>
            </select>
          </div>
          <div>
            <label for="sv-quote" class="mb-1 block text-xs font-semibold">Báo giá (VNĐ)</label>
            <input id="sv-quote" v-model.number="form.quotedPrice" type="number" min="0" step="50000" class="input-canho tabular-nums" />
          </div>
        </div>
        <div>
          <label for="sv-title" class="mb-1 block text-xs font-semibold">Tiêu đề</label>
          <input id="sv-title" v-model="form.title" type="text" required class="input-canho" />
        </div>
        <div>
          <label for="sv-desc" class="mb-1 block text-xs font-semibold">Chi tiết</label>
          <textarea id="sv-desc" v-model="form.description" rows="2" required class="input-canho"></textarea>
        </div>
        <button type="submit" class="btn-primary-pill w-full py-2 text-xs">Tạo phiếu</button>
      </form>
    </div>

    <div class="card-canho p-5 lg:col-span-8">
      <h2 class="mb-4 font-serif text-lg font-bold text-ink">Danh sách Dịch vụ &amp; Bảo trì ({{ tickets.length }})</h2>
      <p v-if="tickets.length === 0" class="text-sm text-muted">Chưa có phiếu nào.</p>
      <div v-else class="space-y-3">
        <div v-for="t in tickets" :key="t._id" class="rounded-xs border border-hairline bg-canvas/50 p-4 text-xs">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span class="font-serif text-sm font-bold text-ink">
                Phòng {{ t.room_id?.roomCode }} — {{ t.title }}
              </span>
              <span
                class="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                :class="
                  t.ticketType === 'maintenance_infra'
                    ? 'bg-status-available-tint text-status-available'
                    : 'bg-gold-tint text-ink'
                "
              >
                {{ t.ticketType === 'maintenance_infra' ? 'Chi phí: Công ty' : 'Chi phí: Cư dân' }}
              </span>
              <span v-if="t.priority === 'urgent'" class="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                KHẨN CẤP
              </span>
              <p class="mt-1 text-muted">{{ t.description }}</p>
              <p class="mt-1 text-muted tabular-nums">
                Báo giá: <strong class="text-ink">{{ formatCurrency(t.quotedPrice) }}</strong>
                {{ t.quoteConfirmedByUser ? '(Khách đã xác nhận)' : '' }}
              </p>
            </div>
            <span class="rounded-full bg-surface-alt px-2.5 py-0.5 font-semibold text-ink">{{ t.status }}</span>
          </div>

          <div class="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-2.5">
            <button
              v-if="['open', 'quoted'].includes(t.status)"
              type="button"
              class="btn-secondary-pill px-3 py-1 text-[11px]"
              @click="process(t, 'in_progress')"
            >
              Điều phối xử lý
            </button>
            <button
              v-if="['open', 'quoted', 'in_progress'].includes(t.status)"
              type="button"
              class="btn-primary-pill px-3 py-1 text-[11px]"
              @click="process(t, 'completed')"
            >
              Hoàn tất (Đưa vào kỳ hóa đơn)
            </button>
            <span v-if="t.rating" class="font-semibold text-gold">
              ★ Đánh giá: {{ t.rating }}/5 ({{ t.reviewComment }})
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import api, { getErrorMessage } from '@/api/axios';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToastStore } from '@/stores/toast';
import { formatCurrency } from '@/utils/format';

const workspaceStore = useWorkspaceStore();
const toastStore = useToastStore();

const rooms = ref([]);
const tickets = ref([]);

const form = reactive({
  room_id: '',
  ticketType: 'add_on_service',
  priority: 'normal',
  quotedPrice: 0,
  title: '',
  description: '',
});

async function loadAll() {
  if (!workspaceStore.currentBuildingId) return;
  try {
    const [rRes, tRes] = await Promise.all([api.get('/rooms'), api.get('/services/building')]);
    rooms.value = rRes.data.data || [];
    tickets.value = tRes.data.data || [];
    if (!form.room_id && rooms.value[0]) form.room_id = rooms.value[0]._id;
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function createTicket() {
  try {
    await api.post('/services', { ...form });
    toastStore.success('Đã tạo phiếu dịch vụ/bảo trì');
    form.title = '';
    form.description = '';
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function process(t, status) {
  try {
    await api.patch(`/services/${t._id}/process`, {
      status,
      assignedTo: 'Kỹ thuật viên tòa nhà',
      incidentExplanation: t.priority === 'urgent' ? 'Đã xử lý khẩn cấp trong 24h' : '',
    });
    toastStore.success('Đã cập nhật phiếu');
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

watch(
  () => workspaceStore.currentBuildingId,
  (id) => {
    if (id) loadAll();
  },
  { immediate: true }
);
</script>
