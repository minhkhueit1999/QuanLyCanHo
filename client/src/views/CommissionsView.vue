<template>
  <div class="space-y-6">
    <!-- Summary KPI Strip -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="card-canho neo-lattice p-5">
        <p class="text-xs uppercase text-muted">Tổng hoa hồng ghi nhận</p>
        <p class="mt-1 font-serif text-2xl font-bold text-primary tabular-nums">
          {{ formatCurrency(totalCommission) }}
        </p>
      </div>
      <div class="card-canho neo-lattice p-5">
        <p class="text-xs uppercase text-muted">Đã chi trả (Ngày 10)</p>
        <p class="mt-1 font-serif text-2xl font-bold text-status-available tabular-nums">
          {{ formatCurrency(totalPaid) }}
        </p>
      </div>
      <div class="card-canho neo-lattice p-5">
        <p class="text-xs uppercase text-muted">Tiền mặt Manager đang giữ</p>
        <p class="mt-1 font-serif text-2xl font-bold text-status-reserved tabular-nums">
          {{ formatCurrency(totalCashHeld) }}
        </p>
      </div>
    </div>

    <!-- Commissions Table -->
    <div class="card-canho p-5">
      <h2 class="mb-2 font-serif text-lg font-bold text-ink">
        Bảng tính Hoa hồng (Tiền phòng thực thu × Tỷ lệ &amp; Chia tách đổi Manager giữa tháng)
      </h2>
      <p class="mb-4 text-xs text-muted">
        Vòng đời: <code>provisional</code> → <code>pending_approval</code> (3 ngày đối soát/khiếu nại) → <code>approved</code> → <code>paid</code> (chi ngày 10 tháng sau).
      </p>

      <p v-if="bookingBillingStore.commissions.length === 0" class="text-sm text-muted">
        Chưa phát sinh hoa hồng tại tòa nhà này.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[840px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Kỳ / Manager</th>
              <th class="px-3 py-2.5">Hóa đơn / Giao dịch</th>
              <th class="px-3 py-2.5 text-right">Tiền phòng thực thu</th>
              <th class="px-3 py-2.5 text-center">Tỷ lệ</th>
              <th class="px-3 py-2.5 text-right">Hoa hồng</th>
              <th class="px-3 py-2.5 text-center">Trạng thái</th>
              <th class="py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="c in bookingBillingStore.commissions" :key="c._id">
              <td class="py-3">
                <p class="font-semibold">{{ c.period }}</p>
                <p class="text-muted">{{ c.manager_id?.fullName }}</p>
              </td>
              <td class="px-3 py-3 text-muted">
                {{ c.invoice_id?.invoiceCode }} • {{ c.payment_id?.transactionCode }}
              </td>
              <td class="px-3 py-3 text-right tabular-nums">{{ formatCurrency(c.roomFeeCollected) }}</td>
              <td class="px-3 py-3 text-center tabular-nums">{{ c.commissionRate }}%</td>
              <td class="px-3 py-3 text-right font-bold text-primary tabular-nums">
                {{ formatCurrency(c.commissionAmount) }}
              </td>
              <td class="px-3 py-3 text-center">
                <span class="rounded-full bg-gold-tint px-2.5 py-0.5 font-semibold text-ink">{{ c.status }}</span>
                <p v-if="c.disputeReason" class="mt-1 text-primary">{{ c.disputeReason }}</p>
              </td>
              <td class="py-3 text-right">
                <div class="inline-flex gap-1.5">
                  <button
                    v-if="authStore.isManager && c.status !== 'paid'"
                    type="button"
                    class="btn-secondary-pill px-2.5 py-1 text-[11px]"
                    @click="openDispute(c)"
                  >
                    Khiếu nại
                  </button>
                  <button
                    v-if="authStore.isAdmin && ['provisional', 'pending_approval', 'disputed'].includes(c.status)"
                    type="button"
                    class="btn-gold-pill px-2.5 py-1 text-[11px]"
                    @click="updateStatus(c, 'approved')"
                  >
                    Duyệt
                  </button>
                  <button
                    v-if="authStore.isAdmin && c.status !== 'paid'"
                    type="button"
                    class="btn-primary-pill px-2.5 py-1 text-[11px]"
                    @click="updateStatus(c, 'paid')"
                  >
                    Chi trả (Ngày 10)
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Cash Remittance Tracking Table (24h limit) -->
    <div class="card-canho p-5">
      <h2 class="mb-2 font-serif text-lg font-bold text-ink">
        Đối soát Tiền mặt Manager thu hộ (Hạn nộp 24h)
      </h2>
      <p v-if="bookingBillingStore.cashPayments.length === 0" class="text-sm text-muted">
        Không có giao dịch tiền mặt nào cần đối soát.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[740px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Mã GD</th>
              <th class="px-3 py-2.5">Người thu</th>
              <th class="px-3 py-2.5 text-right">Số tiền</th>
              <th class="px-3 py-2.5">Hạn nộp 24h</th>
              <th class="px-3 py-2.5">Trạng thái</th>
              <th class="py-2.5 text-right">Nộp quỹ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="p in bookingBillingStore.cashPayments" :key="p._id">
              <td class="py-3 font-semibold">{{ p.transactionCode }}</td>
              <td class="px-3 py-3">{{ p.collectedBy?.fullName || 'N/A' }}</td>
              <td class="px-3 py-3 text-right font-bold tabular-nums">{{ formatCurrency(p.amount) }}</td>
              <td class="px-3 py-3 tabular-nums">{{ formatDateTime(p.remitDueAt) }}</td>
              <td class="px-3 py-3">
                <span
                  class="rounded-full px-2.5 py-0.5 font-semibold"
                  :class="
                    p.cashRemitStatus === 'remitted'
                      ? 'bg-status-available-tint text-status-available'
                      : p.cashRemitStatus === 'overdue_remit'
                        ? 'bg-primary text-white'
                        : 'bg-status-reserved-tint text-status-reserved'
                  "
                >
                  {{ p.cashRemitStatus }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button
                  v-if="p.cashRemitStatus !== 'remitted'"
                  type="button"
                  class="btn-primary-pill px-3 py-1 text-[11px]"
                  @click="remitCash(p)"
                >
                  Xác nhận đã nộp về công ty
                </button>
                <span v-else class="font-semibold text-status-available">Đã đối soát</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Dispute Modal -->
    <Teleport to="body">
      <div
        v-if="disputeModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="disputeModal.open = false"
      >
        <div class="card-gold w-full max-w-sm p-6">
          <h3 class="font-serif text-lg font-bold text-ink">Gửi khiếu nại đối soát hoa hồng</h3>
          <form class="mt-3 space-y-3" @submit.prevent="submitDispute">
            <div>
              <label for="dp-reason" class="mb-1 block text-xs font-semibold">Nội dung khiếu nại</label>
              <textarea id="dp-reason" v-model="disputeModal.reason" rows="3" required class="input-canho"></textarea>
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary-pill" @click="disputeModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Gửi khiếu nại</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useBookingBillingStore } from '@/stores/bookingBilling';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, formatDateTime } from '@/utils/format';

const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const bookingBillingStore = useBookingBillingStore();
const toastStore = useToastStore();

const disputeModal = reactive({ open: false, id: '', reason: '' });

const totalCommission = computed(() =>
  bookingBillingStore.commissions.reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0)
);
const totalPaid = computed(() =>
  bookingBillingStore.commissions
    .filter((c) => c.status === 'paid')
    .reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0)
);
const totalCashHeld = computed(() =>
  bookingBillingStore.cashPayments
    .filter((p) => p.cashRemitStatus !== 'remitted')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0)
);

async function loadAll() {
  if (!workspaceStore.currentBuildingId) return;
  try {
    await bookingBillingStore.fetchCommissionsAndPayments();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openDispute(c) {
  disputeModal.id = c._id;
  disputeModal.reason = '';
  disputeModal.open = true;
}

async function submitDispute() {
  try {
    await api.post(`/commissions/${disputeModal.id}/dispute`, { reason: disputeModal.reason });
    toastStore.success('Đã gửi khiếu nại lên Admin');
    disputeModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function updateStatus(c, status) {
  try {
    await api.patch(`/commissions/${c._id}/status`, { status });
    toastStore.success('Cập nhật hoa hồng thành công');
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function remitCash(p) {
  try {
    await api.patch(`/payments/${p._id}/remit-cash`);
    toastStore.success('Đã xác nhận nộp tiền mặt về công ty');
    await Promise.all([loadAll(), workspaceStore.fetchManagerCashStatus()]);
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
