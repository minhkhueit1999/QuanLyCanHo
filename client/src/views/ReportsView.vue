<template>
  <div class="space-y-6">
    <!-- Admin Scope Toggle -->
    <div
      v-if="authStore.isAdmin"
      class="card-canho flex flex-wrap items-center justify-between gap-3 px-4 py-3"
    >
      <span class="text-xs font-semibold text-ink">
        Phạm vi báo cáo:
        <strong>
          {{ mode === 'building' ? workspaceStore.currentBuilding?.name : 'Tổng hợp toàn hệ thống' }}
        </strong>
      </span>
      <div class="inline-flex rounded-full border border-hairline bg-canvas p-1">
        <button
          type="button"
          class="rounded-full px-3.5 py-1 text-xs font-semibold transition cursor-pointer"
          :class="mode === 'building' ? 'bg-primary text-white' : 'text-muted hover:text-ink'"
          @click="mode = 'building'"
        >
          Tòa nhà đang chọn
        </button>
        <button
          type="button"
          class="rounded-full px-3.5 py-1 text-xs font-semibold transition cursor-pointer"
          :class="mode === 'system' ? 'bg-primary text-white' : 'text-muted hover:text-ink'"
          @click="switchSystem"
        >
          Tổng hợp toàn hệ thống
        </button>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="n in 4" :key="n" class="h-28 animate-pulse rounded-xs border border-hairline bg-surface"></div>
    </div>

    <!-- BUILDING REPORT -->
    <template v-else-if="mode === 'building' && buildingData">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card-canho neo-lattice p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">Tổng số căn hộ</p>
          <p class="mt-2 font-serif text-3xl font-bold text-ink tabular-nums">
            {{ buildingData.kpis.totalRooms }}
          </p>
          <p class="mt-2 text-xs text-muted">
            <strong class="text-status-available">{{ buildingData.kpis.availableCount }} trống</strong> •
            <strong class="text-primary">{{ buildingData.kpis.occupiedCount }} thuê</strong> •
            <strong class="text-status-reserved">{{ buildingData.kpis.reservedCount }} giữ chỗ</strong>
          </p>
        </div>

        <div class="card-canho neo-lattice p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">Tỷ lệ lấp đầy</p>
          <p class="mt-2 font-serif text-3xl font-bold text-status-available tabular-nums">
            {{ buildingData.kpis.occupancyRate }}%
          </p>
          <div class="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
            <div
              class="h-full rounded-full bg-status-available"
              :style="{ width: `${Math.min(100, buildingData.kpis.occupancyRate)}%` }"
            ></div>
          </div>
        </div>

        <div class="card-canho neo-lattice p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">
            Thực thu tháng {{ buildingData.currentMonth }}
          </p>
          <p class="mt-2 font-serif text-2xl font-bold text-primary tabular-nums">
            {{ formatCurrency(buildingData.kpis.currentMonthRevenue) }}
          </p>
          <p class="mt-2 text-xs text-muted tabular-nums">
            Tổng phát hành: {{ formatCurrency(buildingData.kpis.currentMonthBilled) }}
          </p>
        </div>

        <div class="card-canho neo-lattice p-5">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">Hóa đơn chưa thu</p>
          <p class="mt-2 font-serif text-3xl font-bold text-status-reserved tabular-nums">
            {{ buildingData.kpis.unpaidInvoicesCount }}
          </p>
          <p class="mt-2 text-xs font-medium text-primary tabular-nums">
            Công nợ: {{ formatCurrency(buildingData.kpis.unpaidTotalAmount) }}
          </p>
        </div>
      </div>

      <!-- Operational Alerts -->
      <div
        v-if="
          buildingData.kpis.pendingApprovalCount > 0 ||
          buildingData.kpis.overdueInvoicesCount > 0 ||
          buildingData.kpis.overdueManagerCash > 0
        "
        class="card-gold flex flex-wrap items-center gap-3 bg-gold-tint/50 px-5 py-3 text-xs"
      >
        <AlertTriangle class="h-4 w-4 text-status-reserved" />
        <span v-if="buildingData.kpis.pendingApprovalCount > 0">
          <strong>{{ buildingData.kpis.pendingApprovalCount }}</strong> phòng đang chờ Admin duyệt lên sàn.
        </span>
        <span v-if="buildingData.kpis.overdueInvoicesCount > 0" class="text-primary">
          <strong>{{ buildingData.kpis.overdueInvoicesCount }}</strong> hóa đơn đang quá hạn.
        </span>
        <span v-if="buildingData.kpis.overdueManagerCash > 0" class="text-primary">
          <strong>{{ buildingData.kpis.overdueManagerCash }}</strong> khoản tiền mặt Manager quá hạn nộp 24h!
        </span>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div class="card-canho neo-lattice p-5 lg:col-span-7">
          <h2 class="font-serif text-lg font-bold text-ink">Doanh thu 6 tháng gần nhất</h2>
          <p class="mb-4 text-xs text-muted">Số liệu thực thu &amp; công nợ theo tháng</p>
          <RevenueBarChart :data="buildingData.revenueChart" />
        </div>

        <div class="card-canho neo-lattice p-5 lg:col-span-5">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h2 class="font-serif text-lg font-bold text-ink">Hợp đồng sắp hết hạn (45 ngày)</h2>
              <p class="text-xs text-muted">Nhắc gia hạn trước 45 ngày theo quy định</p>
            </div>
            <router-link to="/contracts" class="text-xs font-semibold text-primary hover:underline">
              Chi tiết
            </router-link>
          </div>

          <p
            v-if="buildingData.expiringContracts.length === 0"
            class="rounded-xs border border-dashed border-hairline py-10 text-center text-xs text-muted"
          >
            Không có hợp đồng nào hết hạn trong 45 ngày tới.
          </p>

          <ul v-else class="divide-y divide-hairline">
            <li
              v-for="c in buildingData.expiringContracts"
              :key="c._id"
              class="flex items-center justify-between gap-2 py-3 text-xs"
            >
              <div>
                <p class="font-semibold text-ink">
                  Phòng {{ c.room_id?.roomCode }} — {{ c.user_id?.fullName }}
                </p>
                <p class="text-muted">Hết hạn: {{ formatDate(c.endDate) }}</p>
              </div>
              <span class="rounded-full bg-status-reserved-tint px-2.5 py-0.5 font-semibold text-status-reserved tabular-nums">
                Còn {{ c.daysRemaining }} ngày
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ADMIN PORTFOLIO REPORT -->
    <template v-else-if="mode === 'system' && systemData">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card-canho neo-lattice p-5">
          <p class="text-xs uppercase text-muted">Tổng Tòa nhà</p>
          <p class="mt-1 font-serif text-3xl font-bold">{{ systemData.summary.totalBuildings }}</p>
        </div>
        <div class="card-canho neo-lattice p-5">
          <p class="text-xs uppercase text-muted">Tổng phòng &amp; Lấp đầy</p>
          <p class="mt-1 font-serif text-3xl font-bold text-status-available tabular-nums">
            {{ systemData.summary.totalOccupied }}/{{ systemData.summary.totalRooms }}
            <span class="text-sm">({{ systemData.summary.occupancyRate }}%)</span>
          </p>
        </div>
        <div class="card-canho neo-lattice p-5">
          <p class="text-xs uppercase text-muted">Thực thu tháng {{ systemData.currentMonth }}</p>
          <p class="mt-1 font-serif text-2xl font-bold text-primary tabular-nums">
            {{ formatCurrency(systemData.summary.currentMonthRevenue) }}
          </p>
        </div>
        <div class="card-canho neo-lattice p-5">
          <p class="text-xs uppercase text-muted">Tổng công nợ</p>
          <p class="mt-1 font-serif text-2xl font-bold text-status-reserved tabular-nums">
            {{ formatCurrency(systemData.summary.unpaidTotalAmount) }}
          </p>
        </div>
      </div>

      <div class="card-canho p-5">
        <h2 class="mb-3 font-serif text-lg font-bold text-ink">Hiệu suất vận hành từng Tòa nhà</h2>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-hairline text-xs uppercase text-muted">
                <th class="py-2.5">Tòa nhà</th>
                <th class="px-3 py-2.5">Manager chính</th>
                <th class="px-3 py-2.5 text-center">Lấp đầy</th>
                <th class="px-3 py-2.5 text-right">Đã thu tháng</th>
                <th class="py-2.5 text-right">Chuyển đến</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-hairline">
              <tr v-for="b in systemData.buildings" :key="b._id">
                <td class="py-3">
                  <p class="font-semibold">{{ b.name }}</p>
                  <p class="text-xs text-muted">{{ b.ward_name }}, {{ b.province_name }}</p>
                </td>
                <td class="px-3 py-3 text-xs">{{ b.primaryManager?.fullName || 'Chưa gán' }}</td>
                <td class="px-3 py-3 text-center tabular-nums">
                  {{ b.occupiedCount }}/{{ b.totalRooms }} ({{ b.occupancyRate }}%)
                </td>
                <td class="px-3 py-3 text-right font-semibold text-primary tabular-nums">
                  {{ formatCurrency(b.currentMonthRevenue) }}
                </td>
                <td class="py-3 text-right">
                  <button type="button" class="btn-secondary-pill px-3 py-1 text-xs" @click="selectBld(b._id)">
                    Mở tòa
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { AlertTriangle } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, formatDate } from '@/utils/format';
import RevenueBarChart from '@/components/RevenueBarChart.vue';

const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const toastStore = useToastStore();

const mode = ref('building');
const loading = ref(false);
const buildingData = ref(null);
const systemData = ref(null);

async function loadBuilding() {
  if (!workspaceStore.currentBuildingId) return;
  loading.value = true;
  try {
    const res = await api.get('/dashboard/building');
    buildingData.value = res.data.data;
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
}

async function switchSystem() {
  mode.value = 'system';
  loading.value = true;
  try {
    const res = await api.get('/dashboard/overview');
    systemData.value = res.data.data;
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
}

function selectBld(id) {
  workspaceStore.selectBuilding(id);
  mode.value = 'building';
}

watch(
  () => workspaceStore.currentBuildingId,
  (id) => {
    if (id && mode.value === 'building') loadBuilding();
  },
  { immediate: true }
);
</script>
