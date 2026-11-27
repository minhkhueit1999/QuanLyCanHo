<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
    <div class="card-canho neo-lattice p-5 lg:col-span-4">
      <h2 class="font-serif text-lg font-bold text-ink">Lập biên bản Vi phạm nội quy</h2>
      <p class="mt-1 text-xs text-muted">
        Hệ thống xử lý lũy tiến 3 mức: Nhắc nhở → Cảnh cáo → Phạt tiền
      </p>
      <form class="mt-4 space-y-3" @submit.prevent="submitViolation">
        <div>
          <label for="vl-contract" class="mb-1 block text-xs font-semibold">Hợp đồng / Phòng</label>
          <select id="vl-contract" v-model="form.contract_id" required class="input-canho">
            <option v-for="c in activeContracts" :key="c._id" :value="c._id">
              Phòng {{ c.room_id?.roomCode }} — {{ c.user_id?.fullName }}
            </option>
          </select>
        </div>
        <div>
          <label for="vl-level" class="mb-1 block text-xs font-semibold">Mức độ lũy tiến</label>
          <select id="vl-level" v-model="form.level" class="input-canho">
            <option value="1_reminder">Mức 1: Nhắc nhở (1_reminder)</option>
            <option value="2_warning">Mức 2: Cảnh cáo (2_warning)</option>
            <option value="3_fine">Mức 3: Phạt tiền (3_fine)</option>
          </select>
        </div>
        <div v-if="form.level === '3_fine'">
          <label for="vl-fine" class="mb-1 block text-xs font-semibold">Mức phạt (VNĐ)</label>
          <input id="vl-fine" v-model.number="form.fineAmount" type="number" min="0" step="50000" class="input-canho tabular-nums" />
        </div>
        <div>
          <label for="vl-title" class="mb-1 block text-xs font-semibold">Lỗi vi phạm</label>
          <input id="vl-title" v-model="form.title" type="text" required placeholder="VD: Gây ồn sau 22h / Đỗ xe sai chỗ" class="input-canho" />
        </div>
        <div>
          <label for="vl-desc" class="mb-1 block text-xs font-semibold">Mô tả chi tiết</label>
          <textarea id="vl-desc" v-model="form.description" rows="2" required class="input-canho"></textarea>
        </div>
        <button type="submit" class="btn-primary-pill w-full py-2 text-xs">Lập biên bản</button>
      </form>
    </div>

    <div class="card-canho p-5 lg:col-span-8">
      <h2 class="mb-4 font-serif text-lg font-bold text-ink">Lịch sử vi phạm nội quy ({{ violations.length }})</h2>
      <p v-if="violations.length === 0" class="text-sm text-muted">Không có vi phạm nào được ghi nhận.</p>
      <div v-else class="space-y-3">
        <div v-for="v in violations" :key="v._id" class="rounded-xs border border-hairline p-4 text-xs">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="rounded-full bg-primary-tint px-2.5 py-0.5 font-bold text-primary">{{ v.level }}</span>
              <span class="ml-2 font-serif text-sm font-bold text-ink">
                Phòng {{ v.room_id?.roomCode }} — {{ v.title }}
              </span>
              <p class="mt-1 text-muted">{{ v.description }}</p>
              <p v-if="v.fineAmount > 0" class="mt-1 font-semibold text-primary tabular-nums">
                Tiền phạt: {{ formatCurrency(v.fineAmount) }}
              </p>
            </div>
            <button
              v-if="v.status === 'active'"
              type="button"
              class="btn-secondary-pill px-3 py-1 text-[11px]"
              @click="resolveViolation(v)"
            >
              Đánh dấu đã khắc phục
            </button>
            <span v-else class="font-semibold text-status-available">{{ v.status }}</span>
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

const activeContracts = ref([]);
const violations = ref([]);

const form = reactive({
  contract_id: '',
  level: '1_reminder',
  fineAmount: 200000,
  title: '',
  description: '',
});

async function loadAll() {
  if (!workspaceStore.currentBuildingId) return;
  try {
    const [cRes, vRes] = await Promise.all([
      api.get('/contracts/building', { params: { status: 'active' } }),
      api.get('/violations/building'),
    ]);
    activeContracts.value = cRes.data.data || [];
    violations.value = vRes.data.data || [];
    if (!form.contract_id && activeContracts.value[0]) form.contract_id = activeContracts.value[0]._id;
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function submitViolation() {
  try {
    await api.post('/violations', { ...form });
    toastStore.success('Đã lập biên bản vi phạm');
    form.title = '';
    form.description = '';
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function resolveViolation(v) {
  try {
    await api.patch(`/violations/${v._id}/status`, { status: 'resolved' });
    toastStore.success('Đã cập nhật trạng thái vi phạm');
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
