<template>
  <div class="space-y-6">
    <!-- Top Billing Period & Pricing Info -->
    <div class="card-canho neo-lattice flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div class="flex flex-wrap items-center gap-4">
        <div>
          <label for="inv-month" class="mb-1 block text-xs font-semibold text-muted">Kỳ hóa đơn</label>
          <input id="inv-month" v-model="month" type="month" class="input-canho w-40 py-1.5 tabular-nums" />
        </div>
        <div v-if="workspaceStore.currentBuilding" class="flex flex-wrap gap-2 text-xs text-muted">
          <span class="rounded-full bg-surface-alt px-3 py-1.5">
            Điện: <strong class="text-ink">{{ formatCurrency(workspaceStore.currentBuilding.pricingConfig?.electricityPrice) }}/kWh</strong>
          </span>
          <span class="rounded-full bg-surface-alt px-3 py-1.5">
            Nước: <strong class="text-ink">{{ formatCurrency(workspaceStore.currentBuilding.pricingConfig?.waterPrice) }}/m³</strong>
          </span>
          <span class="rounded-full bg-surface-alt px-3 py-1.5">
            Quản lý: <strong class="text-ink">{{ formatCurrency(workspaceStore.currentBuilding.pricingConfig?.managementFee) }}</strong>
          </span>
        </div>
      </div>

      <button
        type="button"
        class="btn-primary-pill px-5 py-2 text-xs"
        :disabled="savingAll || bookingBillingStore.worksheetRows.length === 0"
        @click="saveAll"
      >
        <Save class="h-3.5 w-3.5" />
        <span>Phát hành tất cả</span>
      </button>
    </div>

    <!-- Worksheet Table -->
    <div class="card-canho p-5">
      <h2 class="mb-4 font-serif text-lg font-bold text-ink">
        Bảng chốt Điện Nước (kèm ảnh công tơ) &amp; Hóa đơn — Kỳ {{ month }}
      </h2>

      <p v-if="bookingBillingStore.worksheetRows.length === 0" class="py-10 text-center text-sm text-muted">
        Chưa có hợp đồng đang hiệu lực để lập hóa đơn trong tháng này.
      </p>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[1180px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Phòng / Cư dân</th>
              <th class="px-2 py-2.5">Điện (Cũ → Mới &amp; Ảnh)</th>
              <th class="px-2 py-2.5">Nước (Cũ → Mới &amp; Ảnh)</th>
              <th class="px-2 py-2.5 text-right">Phòng + QL + Xe + DV + Nợ</th>
              <th class="px-2 py-2.5 text-right">Tổng / Còn thu</th>
              <th class="px-2 py-2.5 text-center">Trạng thái</th>
              <th class="py-2.5 text-right">Nghiệp vụ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="r in bookingBillingStore.worksheetRows" :key="r.contract._id">
              <td class="py-3 pr-2">
                <p class="font-serif text-sm font-bold">Phòng {{ r.room?.roomCode }}</p>
                <p class="text-muted">{{ r.resident?.fullName }}</p>
              </td>

              <td class="px-2 py-3 tabular-nums">
                <div class="flex items-center gap-1">
                  <input v-model.number="r.elecOld" type="number" min="0" :disabled="r.isSaved && !authStore.isAdmin" class="w-16 rounded-xs border border-hairline bg-canvas px-1.5 py-1 text-xs" />
                  <span>→</span>
                  <input v-model.number="r.elecNew" type="number" :min="r.elecOld" :disabled="r.status === 'paid' || (r.isSaved && !authStore.isAdmin)" class="w-16 rounded-xs border border-hairline bg-surface px-1.5 py-1 text-xs font-semibold" />
                </div>
                <input
                  v-model="r.elecProofUrl"
                  type="text"
                  :disabled="r.status === 'paid' || (r.isSaved && !authStore.isAdmin)"
                  placeholder="URL ảnh công tơ điện"
                  class="mt-1 w-36 rounded-xs border border-hairline bg-surface px-1.5 py-0.5 text-[11px]"
                />
                <p class="mt-0.5 text-[11px] text-muted">
                  {{ Math.max(0, r.elecNew - r.elecOld) }} kWh = {{ formatCurrency(calcElec(r)) }}
                </p>
              </td>

              <td class="px-2 py-3 tabular-nums">
                <div class="flex items-center gap-1">
                  <input v-model.number="r.waterOld" type="number" min="0" :disabled="r.isSaved && !authStore.isAdmin" class="w-16 rounded-xs border border-hairline bg-canvas px-1.5 py-1 text-xs" />
                  <span>→</span>
                  <input v-model.number="r.waterNew" type="number" :min="r.waterOld" :disabled="r.status === 'paid' || (r.isSaved && !authStore.isAdmin)" class="w-16 rounded-xs border border-hairline bg-surface px-1.5 py-1 text-xs font-semibold" />
                </div>
                <input
                  v-model="r.waterProofUrl"
                  type="text"
                  :disabled="r.status === 'paid' || (r.isSaved && !authStore.isAdmin)"
                  placeholder="URL ảnh đồng hồ nước"
                  class="mt-1 w-36 rounded-xs border border-hairline bg-surface px-1.5 py-0.5 text-[11px]"
                />
                <p class="mt-0.5 text-[11px] text-muted">
                  {{ Math.max(0, r.waterNew - r.waterOld) }} m³ = {{ formatCurrency(calcWater(r)) }}
                </p>
              </td>

              <td class="px-2 py-3 text-right tabular-nums text-[11px] text-muted">
                <p>Phòng: <strong class="text-ink">{{ formatCurrency(r.roomFee) }}</strong></p>
                <p>QL: {{ formatCurrency(r.managementFee) }} • Xe: {{ formatCurrency(r.parkingFee) }}</p>
                <p v-if="r.serviceFee > 0 || r.previousDebt > 0">
                  DV: {{ formatCurrency(r.serviceFee) }} • Nợ cũ: {{ formatCurrency(r.previousDebt) }}
                </p>
              </td>

              <td class="px-2 py-3 text-right tabular-nums">
                <p class="font-serif text-sm font-bold text-primary">{{ formatCurrency(calcTotal(r)) }}</p>
                <p v-if="r.isSaved" class="text-[11px] text-muted">
                  Còn lại: <strong>{{ formatCurrency(r.remainingAmount) }}</strong>
                </p>
              </td>

              <td class="px-2 py-3 text-center">
                <span
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  :class="(INVOICE_STATUS_META[r.status] || INVOICE_STATUS_META.draft).badgeClass"
                >
                  {{ (INVOICE_STATUS_META[r.status] || INVOICE_STATUS_META.draft).label }}
                </span>
              </td>

              <td class="py-3 text-right">
                <div class="inline-flex flex-wrap justify-end gap-1.5">
                  <button
                    v-if="!r.isSaved || (authStore.isAdmin && r.status !== 'paid')"
                    type="button"
                    class="btn-secondary-pill px-2.5 py-1 text-[11px]"
                    @click="saveInvoice(r)"
                  >
                    {{ r.isSaved ? 'Admin sửa' : 'Phát hành' }}
                  </button>

                  <button
                    v-if="r.invoiceId && ['unpaid', 'partial', 'overdue'].includes(r.status)"
                    type="button"
                    class="btn-primary-pill px-2.5 py-1 text-[11px]"
                    @click="openPayModal(r)"
                  >
                    Thu tiền
                  </button>

                  <button
                    v-if="r.invoiceId && authStore.isAdmin && r.lateFee > 0"
                    type="button"
                    class="btn-gold-pill px-2.5 py-1 text-[11px]"
                    @click="waiveLateFee(r)"
                  >
                    Miễn phí trễ
                  </button>

                  <button
                    v-if="r.invoiceId && authStore.isAdmin && r.paidAmount === 0"
                    type="button"
                    class="rounded-full border border-primary/40 px-2.5 py-1 text-[11px] text-primary hover:bg-primary hover:text-white cursor-pointer"
                    @click="cancelInvoice(r)"
                  >
                    Hủy HĐ
                  </button>

                  <button v-if="r.invoiceId" type="button" class="btn-gold-pill px-2.5 py-1 text-[11px]" @click="openReceipt(r)">
                    <Printer class="h-3 w-3" />
                    Phiếu
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Payment Modal -->
    <Teleport to="body">
      <div
        v-if="payModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="payModal.open = false"
      >
        <div class="card-gold neo-lattice w-full max-w-md p-6">
          <h3 class="font-serif text-xl font-bold text-ink">
            Ghi nhận thanh toán — {{ payModal.row?.invoiceCode }}
          </h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitPayment">
            <div>
              <label for="pay-method" class="mb-1 block text-xs font-semibold">Phương thức</label>
              <select id="pay-method" v-model="payModal.method" class="input-canho">
                <option value="qr_transfer">Chuyển khoản QR công ty</option>
                <option value="cash">Tiền mặt (Kiểm tra hạn mức &amp; nộp 24h)</option>
              </select>
            </div>
            <div>
              <label for="pay-amt" class="mb-1 block text-xs font-semibold">Số tiền thực nhận (VNĐ)</label>
              <input id="pay-amt" v-model.number="payModal.amount" type="number" min="1000" required class="input-canho tabular-nums" />
              <p class="mt-1 text-[11px] text-muted">
                Còn phải thu: {{ formatCurrency(payModal.row?.remainingAmount) }} (hỗ trợ thiếu/dư)
              </p>
            </div>
            <div>
              <label for="pay-note" class="mb-1 block text-xs font-semibold">Nội dung / Mã tham chiếu</label>
              <input id="pay-note" v-model="payModal.referenceNote" type="text" class="input-canho" />
            </div>
            <label class="flex items-center gap-2 text-xs text-ink cursor-pointer">
              <input v-model="payModal.wrongCodeFlag" type="checkbox" class="h-4 w-4 accent-primary" />
              <span>Đánh dấu sai mã giao dịch (chờ Admin đối soát)</span>
            </label>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="payModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Xác nhận thu tiền</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <InvoiceReceiptModal
      :open="receiptOpen"
      :receipt="selectedReceipt"
      :building="workspaceStore.currentBuilding"
      @close="receiptOpen = false"
    />
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { Save, Printer } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useBookingBillingStore } from '@/stores/bookingBilling';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, getCurrentMonth, INVOICE_STATUS_META } from '@/utils/format';
import InvoiceReceiptModal from '@/components/InvoiceReceiptModal.vue';

const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const bookingBillingStore = useBookingBillingStore();
const toastStore = useToastStore();

const month = ref(getCurrentMonth());
const savingAll = ref(false);
const receiptOpen = ref(false);
const selectedReceipt = ref(null);

const payModal = reactive({
  open: false,
  row: null,
  method: 'qr_transfer',
  amount: 0,
  referenceNote: '',
  wrongCodeFlag: false,
});

function calcElec(r) {
  return Math.max(0, (Number(r.elecNew) || 0) - (Number(r.elecOld) || 0)) * (Number(r.elecPrice) || 0);
}
function calcWater(r) {
  return Math.max(0, (Number(r.waterNew) || 0) - (Number(r.waterOld) || 0)) * (Number(r.waterPrice) || 0);
}
function calcTotal(r) {
  return Math.max(
    0,
    calcElec(r) +
      calcWater(r) +
      (Number(r.roomFee) || 0) +
      (Number(r.managementFee) || 0) +
      (Number(r.parkingFee) || 0) +
      (Number(r.serviceFee) || 0) +
      (Number(r.previousDebt) || 0) +
      (Number(r.lateFee) || 0) -
      (Number(r.discountAmount) || 0)
  );
}

async function fetchWorksheet() {
  if (!workspaceStore.currentBuildingId || !month.value) return;
  try {
    await bookingBillingStore.fetchWorksheet(month.value);
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function saveInvoice(r, silent = false) {
  try {
    const res = await api.post('/invoices', {
      contract_id: r.contract._id,
      billing_month: month.value,
      elecOld: r.elecOld,
      elecNew: r.elecNew,
      elecPrice: r.elecPrice,
      elecProofUrl: r.elecProofUrl,
      waterOld: r.waterOld,
      waterNew: r.waterNew,
      waterPrice: r.waterPrice,
      waterProofUrl: r.waterProofUrl,
      roomFee: r.roomFee,
      managementFee: r.managementFee,
      parkingFee: r.parkingFee,
      serviceFee: r.serviceFee,
      previousDebt: r.previousDebt,
      discountAmount: r.discountAmount,
      serviceTicketIds: r.pendingServiceTicketIds || [],
      adminReason: r.isSaved ? 'Admin điều chỉnh hóa đơn/chỉ số đã chốt' : '',
    });
    if (!silent) toastStore.success(res.data.message);
    await fetchWorksheet();
    return true;
  } catch (err) {
    toastStore.error(getErrorMessage(err));
    return false;
  }
}

async function saveAll() {
  savingAll.value = true;
  let okCount = 0;
  for (const r of bookingBillingStore.worksheetRows.filter((x) => !x.isSaved)) {
    const ok = await saveInvoice(r, true);
    if (ok) okCount += 1;
  }
  savingAll.value = false;
  if (okCount > 0) toastStore.success(`Đã phát hành ${okCount} hóa đơn kỳ ${month.value}`);
}

function openPayModal(r) {
  payModal.row = r;
  payModal.method = 'qr_transfer';
  payModal.amount = r.remainingAmount;
  payModal.referenceNote = r.invoiceCode;
  payModal.wrongCodeFlag = false;
  payModal.open = true;
}

async function submitPayment() {
  try {
    const res = await api.post('/payments/invoice', {
      invoice_id: payModal.row.invoiceId,
      method: payModal.method,
      amount: payModal.amount,
      referenceNote: payModal.referenceNote,
      wrongCodeFlag: payModal.wrongCodeFlag,
    });
    toastStore.success(res.data.message);
    payModal.open = false;
    await Promise.all([fetchWorksheet(), workspaceStore.fetchManagerCashStatus()]);
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function waiveLateFee(r) {
  try {
    await api.patch(`/invoices/${r.invoiceId}/waive-late-fee`, { reason: 'Admin miễn phí trễ hạn' });
    toastStore.success('Đã miễn phí trễ hạn & ghi Audit Log');
    await fetchWorksheet();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function cancelInvoice(r) {
  try {
    await api.patch(`/invoices/${r.invoiceId}/cancel`, { reason: 'Admin hủy hóa đơn lập lại' });
    toastStore.success('Đã hủy hóa đơn & ghi Audit Log');
    await fetchWorksheet();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openReceipt(r) {
  selectedReceipt.value = {
    invoiceCode: r.invoiceCode,
    billing_month: month.value,
    roomCode: r.room?.roomCode,
    floor: r.room?.floor,
    residentName: r.resident?.fullName || '',
    elecOld: r.elecOld,
    elecNew: r.elecNew,
    elecPrice: r.elecPrice,
    waterOld: r.waterOld,
    waterNew: r.waterNew,
    waterPrice: r.waterPrice,
    roomFee: r.roomFee,
    managementFee: r.managementFee,
    parkingFee: r.parkingFee,
    serviceFee: r.serviceFee,
    previousDebt: r.previousDebt,
    discountAmount: r.discountAmount,
    lateFee: r.lateFee,
    totalAmount: calcTotal(r),
    paidAmount: r.paidAmount,
    remainingAmount: r.remainingAmount,
    status: r.status,
  };
  receiptOpen.value = true;
}

watch(month, fetchWorksheet);
watch(
  () => workspaceStore.currentBuildingId,
  (id) => {
    if (id) fetchWorksheet();
  },
  { immediate: true }
);
</script>
