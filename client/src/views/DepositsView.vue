<template>
  <div class="space-y-6">
    <!-- Tab Selector -->
    <div class="inline-flex rounded-full border border-hairline bg-surface p-1 shadow-sm">
      <button
        type="button"
        class="rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer"
        :class="activeTab === 'deposits' ? 'bg-primary text-white' : 'text-muted hover:text-ink'"
        @click="activeTab = 'deposits'"
      >
        Phiếu đặt cọc giữ chỗ ({{ bookingBillingStore.deposits.length }})
      </button>
      <button
        type="button"
        class="rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer"
        :class="activeTab === 'bookings' ? 'bg-primary text-white' : 'text-muted hover:text-ink'"
        @click="activeTab = 'bookings'"
      >
        Lịch hẹn xem phòng ({{ bookingBillingStore.viewBookings.length }})
      </button>
    </div>

    <!-- TAB 1: DEPOSITS -->
    <div v-if="activeTab === 'deposits'" class="card-canho p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-serif text-lg font-bold text-ink">Phiếu đặt cọc giữ chỗ</h2>
          <p class="text-xs text-muted">
            QR giữ chỗ 15 phút • Tiền mặt giữ chỗ 24 giờ • Tạm khóa tự hủy khi chờ xác nhận giao dịch (`payment_verifying`)
          </p>
        </div>
      </div>

      <p v-if="bookingBillingStore.deposits.length === 0" class="text-sm text-muted">
        Chưa có phiếu đặt cọc nào tại tòa nhà này.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[820px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Mã cọc</th>
              <th class="px-3 py-2.5">Phòng / Khách</th>
              <th class="px-3 py-2.5 text-right">Số tiền</th>
              <th class="px-3 py-2.5">Hạn giữ chỗ</th>
              <th class="px-3 py-2.5">Trạng thái</th>
              <th class="py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="d in bookingBillingStore.deposits" :key="d._id">
              <td class="py-3 font-semibold">{{ d.depositCode }}</td>
              <td class="px-3 py-3">
                <p class="font-bold">Phòng {{ d.room_id?.roomCode }}</p>
                <p class="text-muted">{{ d.user_id?.fullName }} • {{ d.user_id?.phone }}</p>
              </td>
              <td class="px-3 py-3 text-right font-semibold text-primary tabular-nums">
                {{ formatCurrency(d.amount) }}
              </td>
              <td class="px-3 py-3 tabular-nums">
                <p>{{ formatDateTime(d.hold_expires_at) }}</p>
                <span class="text-muted">{{ d.paymentMethod === 'qr_transfer' ? 'QR 15 phút' : 'Tiền mặt 24h' }}</span>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-full bg-gold-tint px-2.5 py-0.5 font-semibold text-ink">
                  {{ d.status }}
                </span>
              </td>
              <td class="py-3 text-right">
                <div class="inline-flex flex-wrap justify-end gap-1.5">
                  <button
                    v-if="['pending_payment', 'payment_verifying'].includes(d.status)"
                    type="button"
                    class="btn-primary-pill px-3 py-1 text-[11px]"
                    @click="confirmDeposit(d)"
                  >
                    Xác nhận thu cọc
                  </button>
                  <router-link
                    v-if="d.status === 'held'"
                    to="/contracts"
                    class="btn-gold-pill px-3 py-1 text-[11px]"
                  >
                    Chuyển lập Hợp đồng →
                  </router-link>
                  <button
                    v-if="d.status === 'held' && authStore.isAdmin"
                    type="button"
                    class="btn-secondary-pill px-3 py-1 text-[11px]"
                    @click="openRefundModal(d)"
                  >
                    Hoàn cọc (Audit)
                  </button>
                  <button
                    v-if="['held', 'pending_payment', 'payment_verifying'].includes(d.status)"
                    type="button"
                    class="rounded-full border border-primary/40 px-2.5 py-1 text-[11px] text-primary hover:bg-primary hover:text-white cursor-pointer"
                    @click="forfeitDeposit(d)"
                  >
                    Hủy / Mất cọc
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: VIEW BOOKINGS -->
    <div v-else class="card-canho p-5 space-y-4">
      <h2 class="font-serif text-lg font-bold text-ink">Lịch hẹn xem phòng</h2>
      <p v-if="bookingBillingStore.viewBookings.length === 0" class="text-sm text-muted">
        Chưa có lịch hẹn xem phòng tại tòa nhà này.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Phòng</th>
              <th class="px-3 py-2.5">Khách hẹn</th>
              <th class="px-3 py-2.5">Thời gian &amp; Hình thức</th>
              <th class="px-3 py-2.5">Kết quả</th>
              <th class="py-2.5 text-right">Cập nhật kết quả</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="b in bookingBillingStore.viewBookings" :key="b._id">
              <td class="py-3 font-serif text-sm font-bold">{{ b.room_id?.roomCode || 'N/A' }}</td>
              <td class="px-3 py-3">
                <p class="font-semibold">{{ b.visitorName }}</p>
                <p class="text-muted tabular-nums">{{ b.visitorPhone }}</p>
              </td>
              <td class="px-3 py-3 tabular-nums">
                <p>{{ formatDateTime(b.scheduledAt) }}</p>
                <span class="text-muted">{{ b.bookingType === 'video_call' ? 'Video Call' : 'Trực tiếp' }}</span>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-full bg-surface-alt px-2.5 py-0.5 font-semibold">{{ b.outcome }}</span>
                <p v-if="b.rejectionReason" class="mt-1 text-primary">Lý do: {{ b.rejectionReason }}</p>
              </td>
              <td class="py-3 text-right">
                <div class="inline-flex gap-1.5">
                  <button type="button" class="btn-secondary-pill px-2.5 py-1 text-[11px]" @click="updateOutcome(b, 'interested')">
                    Quan tâm
                  </button>
                  <button type="button" class="btn-primary-pill px-2.5 py-1 text-[11px]" @click="updateOutcome(b, 'deposited')">
                    Đã cọc
                  </button>
                  <button
                    type="button"
                    class="rounded-full border border-primary/40 px-2.5 py-1 text-[11px] text-primary hover:bg-primary hover:text-white cursor-pointer"
                    @click="openRejectBooking(b)"
                  >
                    Từ chối
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Admin Sensitive Refund Modal -->
    <Teleport to="body">
      <div
        v-if="refundModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="refundModal.open = false"
      >
        <div class="card-gold neo-lattice w-full max-w-md p-6">
          <h3 class="font-serif text-xl font-bold text-primary">Duyệt Hoàn tiền cọc (Audit Log)</h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitRefund">
            <div>
              <label for="rf-amt" class="mb-1 block text-xs font-semibold">Số tiền hoàn lại (VNĐ)</label>
              <input id="rf-amt" v-model.number="refundModal.refundAmount" type="number" min="0" required class="input-canho tabular-nums" />
            </div>
            <div>
              <label for="rf-reason" class="mb-1 block text-xs font-semibold">Lý do hoàn cọc (Bắt buộc)</label>
              <input id="rf-reason" v-model="refundModal.reason" type="text" required class="input-canho" />
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="refundModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Xác nhận hoàn cọc</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Reject Booking Reason Modal -->
    <Teleport to="body">
      <div
        v-if="rejectModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="rejectModal.open = false"
      >
        <div class="card-gold w-full max-w-sm p-6">
          <h3 class="font-serif text-lg font-bold text-ink">Ghi nhận lý do từ chối</h3>
          <form class="mt-3 space-y-3" @submit.prevent="submitRejectBooking">
            <div>
              <label for="rj-reason" class="mb-1 block text-xs font-semibold">Lý do khách từ chối thuê</label>
              <input id="rj-reason" v-model="rejectModal.reason" type="text" required class="input-canho" />
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary-pill" @click="rejectModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Lưu kết quả</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
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

const activeTab = ref('deposits');
const refundModal = reactive({ open: false, depositId: '', refundAmount: 0, reason: '' });
const rejectModal = reactive({ open: false, bookingId: '', reason: '' });

async function loadAll() {
  if (!workspaceStore.currentBuildingId) return;
  try {
    await bookingBillingStore.fetchBuildingLeasingData();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function confirmDeposit(d) {
  try {
    await api.post(`/deposits/${d._id}/confirm`);
    toastStore.success('Đã xác nhận thu cọc (ACID Transaction)');
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openRefundModal(d) {
  refundModal.depositId = d._id;
  refundModal.refundAmount = d.amount;
  refundModal.reason = '';
  refundModal.open = true;
}

async function submitRefund() {
  try {
    await api.post(`/deposits/${refundModal.depositId}/refund`, {
      refundAmount: refundModal.refundAmount,
      reason: refundModal.reason,
    });
    refundModal.open = false;
    toastStore.success('Đã hoàn cọc & ghi nhận Audit Log');
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function forfeitDeposit(d) {
  try {
    await api.post(`/deposits/${d._id}/forfeit`, { reason: 'Hủy giữ chỗ' });
    toastStore.success('Đã hủy phiếu cọc và mở lại phòng');
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function updateOutcome(b, outcome) {
  try {
    await api.patch(`/bookings/${b._id}/outcome`, { outcome });
    toastStore.success('Đã cập nhật kết quả xem phòng');
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openRejectBooking(b) {
  rejectModal.bookingId = b._id;
  rejectModal.reason = '';
  rejectModal.open = true;
}

async function submitRejectBooking() {
  try {
    await api.patch(`/bookings/${rejectModal.bookingId}/outcome`, {
      outcome: 'rejected',
      rejectionReason: rejectModal.reason,
    });
    rejectModal.open = false;
    toastStore.success('Đã ghi nhận lý do từ chối');
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
