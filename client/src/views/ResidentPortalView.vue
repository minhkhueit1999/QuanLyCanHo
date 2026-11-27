<template>
  <div class="container-canho py-8 space-y-6">
    <!-- User Lifecycle Header -->
    <div class="card-gold neo-lattice flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <span class="text-xs font-semibold uppercase tracking-wider text-muted">
          Cổng Khách thuê &amp; Cư dân canho.com
        </span>
        <h1 class="font-serif text-2xl font-bold text-ink">
          Xin chào, {{ authStore.user?.fullName }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted">Trạng thái vòng đời:</span>
        <span class="rounded-full border border-gold bg-gold-tint px-3.5 py-1 text-xs font-bold text-ink">
          {{ USER_LIFECYCLE_LABELS[authStore.user?.userStatus] || 'Khách vãng lai' }}
        </span>
      </div>
    </div>

    <!-- Portal Tabs -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer"
        :class="
          activeTab === tab.id
            ? 'bg-primary text-white'
            : 'border border-hairline bg-surface text-muted hover:text-ink'
        "
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- TAB 1: DEPOSITS -->
    <div v-if="activeTab === 'deposits'" class="card-canho p-5 space-y-4">
      <h2 class="font-serif text-lg font-bold text-ink">Phiếu đặt cọc giữ chỗ của bạn</h2>
      <p v-if="deposits.length === 0" class="text-sm text-muted">Bạn chưa có phiếu đặt cọc nào.</p>
      <div v-else class="space-y-3">
        <div
          v-for="d in deposits"
          :key="d._id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-hairline bg-canvas/60 p-4"
        >
          <div>
            <p class="font-semibold text-ink">
              {{ d.depositCode }} • Phòng {{ d.room_id?.roomCode }} ({{ d.building_id?.name }})
            </p>
            <p class="mt-0.5 text-xs text-muted tabular-nums">
              Số tiền: <strong class="text-primary">{{ formatCurrency(d.amount) }}</strong> •
              Hạn giữ chỗ: {{ formatDateTime(d.hold_expires_at) }} • Trạng thái:
              <strong>{{ d.status }}</strong>
            </p>
          </div>
          <div v-if="d.status === 'pending_payment'" class="flex items-center gap-2">
            <button
              type="button"
              class="btn-primary-pill px-4 py-1.5 text-xs"
              @click="submitProof(d)"
            >
              Tôi đã chuyển khoản (Khóa tự hủy)
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: CONTRACTS -->
    <div v-else-if="activeTab === 'contracts'" class="card-canho p-5 space-y-4">
      <h2 class="font-serif text-lg font-bold text-ink">Hợp đồng &amp; Bàn giao tài sản</h2>
      <p v-if="contracts.length === 0" class="text-sm text-muted">Chưa có hợp đồng thuê nào.</p>
      <div v-else class="space-y-3">
        <div
          v-for="c in contracts"
          :key="c._id"
          class="rounded-xs border border-hairline bg-canvas/60 p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-serif text-base font-bold text-ink">
                {{ c.contractCode }} • Phòng {{ c.room_id?.roomCode }} — {{ c.building_id?.name }}
              </p>
              <p class="mt-1 text-xs text-muted tabular-nums">
                Giá thuê: <strong>{{ formatCurrency(c.monthlyRent) }}</strong> • Cọc:
                {{ formatCurrency(c.depositAmount) }} • {{ formatDate(c.startDate) }} →
                {{ formatDate(c.endDate) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Bàn giao: Điện đầu {{ c.handover?.elecInitial }}, Nước đầu {{ c.handover?.waterInitial }},
                {{ c.handover?.keysGiven }} chìa khóa, {{ c.handover?.cardsGiven }} thẻ từ
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-gold-tint px-3 py-1 text-xs font-bold text-ink">
                {{ c.status }}
              </span>
              <button
                v-if="c.status === 'active'"
                type="button"
                class="btn-secondary-pill px-3.5 py-1.5 text-xs"
                @click="requestCheckout(c)"
              >
                Báo trả phòng (trước 30 ngày)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: INVOICES -->
    <div v-else-if="activeTab === 'invoices'" class="card-canho p-5 space-y-4">
      <h2 class="font-serif text-lg font-bold text-ink">Hóa đơn hàng tháng &amp; Thanh toán QR</h2>
      <p v-if="invoices.length === 0" class="text-sm text-muted">Chưa có hóa đơn nào.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[700px] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-hairline text-xs uppercase text-muted">
              <th class="py-2.5">Mã HĐ</th>
              <th class="px-3 py-2.5">Kỳ / Phòng</th>
              <th class="px-3 py-2.5 text-right">Tổng tiền</th>
              <th class="px-3 py-2.5 text-right">Còn phải trả</th>
              <th class="px-3 py-2.5 text-center">Trạng thái</th>
              <th class="py-2.5 text-right">Thanh toán QR</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="inv in invoices" :key="inv._id">
              <td class="py-3 font-semibold">{{ inv.invoiceCode }}</td>
              <td class="px-3 py-3 text-xs text-muted">
                {{ inv.billing_month }} • P{{ inv.room_id?.roomCode }} ({{ inv.building_id?.name }})
              </td>
              <td class="px-3 py-3 text-right tabular-nums">{{ formatCurrency(inv.totalAmount) }}</td>
              <td class="px-3 py-3 text-right font-bold text-primary tabular-nums">
                {{ formatCurrency(inv.remainingAmount) }}
              </td>
              <td class="px-3 py-3 text-center">
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :class="(INVOICE_STATUS_META[inv.status] || INVOICE_STATUS_META.unpaid).badgeClass"
                >
                  {{ (INVOICE_STATUS_META[inv.status] || INVOICE_STATUS_META.unpaid).label }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button
                  v-if="['unpaid', 'partial', 'overdue'].includes(inv.status)"
                  type="button"
                  class="btn-primary-pill px-3.5 py-1.5 text-xs"
                  @click="payInvoiceQR(inv)"
                >
                  Thanh toán QR ngay
                </button>
                <span v-else class="text-xs text-status-available font-semibold">Hoàn tất</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: SERVICES & VIOLATIONS -->
    <div v-else-if="activeTab === 'services'" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="card-canho p-5 space-y-4">
        <h2 class="font-serif text-lg font-bold text-ink">Đặt Dịch vụ / Báo sự cố</h2>
        <form class="space-y-3" @submit.prevent="createTicket">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="pt-type" class="mb-1 block text-xs font-semibold">Loại yêu cầu</label>
              <select id="pt-type" v-model="ticketForm.ticketType" class="input-canho">
                <option value="add_on_service">Dịch vụ đi kèm (giặt ủi, dọn phòng)</option>
                <option value="maintenance_infra">Sự cố hạ tầng (điện, nước)</option>
                <option value="maintenance_resident_fault">Hư hỏng thiết bị trong phòng</option>
              </select>
            </div>
            <div>
              <label for="pt-prio" class="mb-1 block text-xs font-semibold">Mức độ</label>
              <select id="pt-prio" v-model="ticketForm.priority" class="input-canho">
                <option value="normal">Bình thường</option>
                <option value="urgent">Khẩn cấp (xử lý ngay)</option>
              </select>
            </div>
          </div>
          <div>
            <label for="pt-title" class="mb-1 block text-xs font-semibold">Tiêu đề</label>
            <input id="pt-title" v-model="ticketForm.title" type="text" required class="input-canho" placeholder="VD: Vệ sinh máy lạnh / Hỏng vòi sen" />
          </div>
          <div>
            <label for="pt-desc" class="mb-1 block text-xs font-semibold">Mô tả chi tiết</label>
            <textarea id="pt-desc" v-model="ticketForm.description" rows="2" required class="input-canho"></textarea>
          </div>
          <button type="submit" class="btn-primary-pill px-5 py-2 text-xs">Gửi yêu cầu</button>
        </form>

        <div class="space-y-2.5 border-t border-hairline pt-4">
          <div v-for="t in tickets" :key="t._id" class="rounded-xs border border-hairline bg-canvas/50 p-3 text-xs">
            <div class="flex items-center justify-between">
              <strong class="text-ink">{{ t.title }}</strong>
              <span class="rounded-full bg-surface-alt px-2 py-0.5 font-semibold">{{ t.status }}</span>
            </div>
            <p class="mt-1 text-muted">Báo giá: {{ formatCurrency(t.quotedPrice) }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-if="t.status === 'quoted' && !t.quoteConfirmedByUser"
                type="button"
                class="btn-primary-pill px-3 py-1 text-[11px]"
                @click="confirmQuote(t)"
              >
                Đồng ý báo giá
              </button>
              <button
                v-if="t.status === 'completed'"
                type="button"
                class="btn-gold-pill px-3 py-1 text-[11px]"
                @click="rateTicket(t, 5)"
              >
                Nghiệm thu &amp; Chấm 5★
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card-canho p-5 space-y-4">
        <h2 class="font-serif text-lg font-bold text-ink">Lịch sử Xem phòng &amp; Vi phạm</h2>
        <div class="space-y-2">
          <p class="text-xs font-semibold text-muted">Lịch hẹn xem phòng ({{ bookings.length }}):</p>
          <div v-for="b in bookings" :key="b._id" class="rounded-xs border border-hairline p-3 text-xs">
            <p class="font-semibold">{{ b.building_id?.name }} — Phòng {{ b.room_id?.roomCode }}</p>
            <p class="text-muted">{{ formatDateTime(b.scheduledAt) }} • Kết quả: {{ b.outcome }}</p>
          </div>
        </div>
        <div class="space-y-2 border-t border-hairline pt-3">
          <p class="text-xs font-semibold text-muted">Thông báo nội quy ({{ violations.length }}):</p>
          <div v-for="v in violations" :key="v._id" class="rounded-xs border border-primary/30 bg-primary-tint p-3 text-xs">
            <p class="font-bold text-primary">{{ v.level }} • {{ v.title }}</p>
            <p class="text-ink">{{ v.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  INVOICE_STATUS_META,
  USER_LIFECYCLE_LABELS,
} from '@/utils/format';

const authStore = useAuthStore();
const toastStore = useToastStore();

const activeTab = ref('deposits');
const tabs = [
  { id: 'deposits', label: 'Phiếu đặt cọc' },
  { id: 'contracts', label: 'Hợp đồng thuê' },
  { id: 'invoices', label: 'Hóa đơn & QR' },
  { id: 'services', label: 'Dịch vụ, Sự cố & Lịch hẹn' },
];

const deposits = ref([]);
const contracts = ref([]);
const invoices = ref([]);
const tickets = ref([]);
const bookings = ref([]);
const violations = ref([]);

const ticketForm = reactive({
  ticketType: 'add_on_service',
  priority: 'normal',
  title: '',
  description: '',
});

async function loadPortal() {
  try {
    const [depRes, conRes, invRes, tktRes, bkRes, vioRes] = await Promise.all([
      api.get('/deposits/my'),
      api.get('/contracts/my'),
      api.get('/invoices/my'),
      api.get('/services/my'),
      api.get('/bookings/my'),
      api.get('/violations/my'),
    ]);
    deposits.value = depRes.data.data || [];
    contracts.value = conRes.data.data || [];
    invoices.value = invRes.data.data || [];
    tickets.value = tktRes.data.data || [];
    bookings.value = bkRes.data.data || [];
    violations.value = vioRes.data.data || [];
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function submitProof(dep) {
  try {
    await api.patch(`/deposits/${dep._id}/submit-proof`, {
      paymentProofUrl: 'CK QR canho.com',
    });
    toastStore.success('Đã gửi minh chứng & tạm khóa tự hủy giữ chỗ');
    await loadPortal();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function requestCheckout(contract) {
  try {
    const in31Days = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
    await api.post(`/contracts/${contract._id}/request-checkout`, {
      desiredCheckoutDate: in31Days,
    });
    toastStore.success('Đã gửi thông báo trả phòng trước 30 ngày');
    await loadPortal();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function payInvoiceQR(inv) {
  try {
    await api.post('/payments/invoice', {
      invoice_id: inv._id,
      method: 'qr_transfer',
      amount: inv.remainingAmount,
      referenceNote: `QR ${inv.invoiceCode}`,
    });
    toastStore.success(`Đã thanh toán hóa đơn ${inv.invoiceCode}`);
    await loadPortal();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function createTicket() {
  try {
    await api.post('/services', { ...ticketForm });
    toastStore.success('Đã gửi yêu cầu thành công');
    ticketForm.title = '';
    ticketForm.description = '';
    await loadPortal();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function confirmQuote(t) {
  try {
    await api.patch(`/services/${t._id}/confirm-quote`);
    toastStore.success('Đã xác nhận báo giá');
    await loadPortal();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function rateTicket(t, rating) {
  try {
    await api.patch(`/services/${t._id}/rate`, { rating, reviewComment: 'Hài lòng' });
    toastStore.success('Đã nghiệm thu & đánh giá');
    await loadPortal();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

onMounted(loadPortal);
</script>
