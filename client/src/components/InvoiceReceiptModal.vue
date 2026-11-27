<template>
  <Teleport to="body">
    <div
      v-if="open && receipt"
      class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Phiếu báo thu tiền phòng và dịch vụ"
      @click.self="$emit('close')"
    >
      <div class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xs bg-surface shadow-canho">
        <div
          class="no-print flex items-center justify-between border-b border-hairline bg-wood-deep px-6 py-4 text-white"
        >
          <div>
            <p class="font-serif text-base font-bold text-white">canho.com — Phiếu Báo Thu</p>
            <p class="text-[11px] text-gold">Đẳng cấp tạo nên thương hiệu</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-primary-pill px-4 py-1.5 text-xs" @click="printDoc">
              <Printer class="h-3.5 w-3.5" />
              In phiếu thu
            </button>
            <button
              type="button"
              class="rounded-full p-1.5 text-white/75 hover:bg-wood cursor-pointer"
              aria-label="Đóng"
              @click="$emit('close')"
            >
              <X class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="printable-document p-6 sm:p-8">
          <div class="card-gold neo-lattice p-6">
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-4">
              <div>
                <p class="font-serif text-lg font-bold text-primary">canho.com</p>
                <p class="text-[11px] font-medium text-gold">Đẳng cấp tạo nên thương hiệu</p>
                <h2 class="mt-2 font-serif text-xl font-bold text-ink">
                  {{ building?.name || receipt.buildingName || 'Tòa nhà canho.com' }}
                </h2>
                <p class="text-xs text-muted">{{ building?.address || receipt.buildingAddress }}</p>
              </div>
              <div class="text-right">
                <span class="seal-badge uppercase">
                  {{ receipt.status === 'paid' ? 'ĐÃ THANH TOÁN' : receipt.status === 'partial' ? 'THU MỘT PHẦN' : 'CHỜ THANH TOÁN' }}
                </span>
                <p class="mt-2 text-xs text-muted">
                  Mã HĐ: <strong class="text-ink">{{ receipt.invoiceCode }}</strong>
                </p>
                <p class="text-xs text-muted">
                  Kỳ hóa đơn: <strong class="text-ink">{{ receipt.billing_month }}</strong>
                </p>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 rounded-xs bg-surface-alt/70 p-4 text-sm sm:grid-cols-2">
              <div>
                <span class="text-xs text-muted">Căn hộ / Phòng:</span>
                <p class="font-serif font-bold text-ink">
                  Phòng {{ receipt.roomCode }} (Tầng {{ receipt.floor }})
                </p>
              </div>
              <div>
                <span class="text-xs text-muted">Cư dân đại diện:</span>
                <p class="font-semibold text-ink">{{ receipt.residentName }}</p>
              </div>
            </div>

            <div class="mt-5 overflow-x-auto">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="border-b border-hairline text-left text-xs uppercase text-muted">
                    <th class="py-2 pr-3">Khoản mục</th>
                    <th class="px-3 py-2">Chi tiết</th>
                    <th class="py-2 pl-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-hairline">
                  <tr>
                    <td class="py-2.5 pr-3 font-medium">Tiền thuê căn hộ</td>
                    <td class="px-3 py-2.5 text-muted">Tháng {{ receipt.billing_month }}</td>
                    <td class="py-2.5 pl-3 text-right font-semibold tabular-nums">
                      {{ formatCurrency(receipt.roomFee) }}
                    </td>
                  </tr>
                  <tr>
                    <td class="py-2.5 pr-3 font-medium">Tiền điện</td>
                    <td class="px-3 py-2.5 text-muted tabular-nums">
                      {{ receipt.elecOld }} → {{ receipt.elecNew }} ({{ receipt.elecNew - receipt.elecOld }} kWh × {{ formatCurrency(receipt.elecPrice) }})
                    </td>
                    <td class="py-2.5 pl-3 text-right font-semibold tabular-nums">
                      {{ formatCurrency((receipt.elecNew - receipt.elecOld) * receipt.elecPrice) }}
                    </td>
                  </tr>
                  <tr>
                    <td class="py-2.5 pr-3 font-medium">Tiền nước</td>
                    <td class="px-3 py-2.5 text-muted tabular-nums">
                      {{ receipt.waterOld }} → {{ receipt.waterNew }} ({{ receipt.waterNew - receipt.waterOld }} m³ × {{ formatCurrency(receipt.waterPrice) }})
                    </td>
                    <td class="py-2.5 pl-3 text-right font-semibold tabular-nums">
                      {{ formatCurrency((receipt.waterNew - receipt.waterOld) * receipt.waterPrice) }}
                    </td>
                  </tr>
                  <tr>
                    <td class="py-2.5 pr-3 font-medium">Phí quản lý &amp; Gửi xe</td>
                    <td class="px-3 py-2.5 text-muted">Quản lý {{ formatCurrency(receipt.managementFee) }} + Xe {{ formatCurrency(receipt.parkingFee) }}</td>
                    <td class="py-2.5 pl-3 text-right font-semibold tabular-nums">
                      {{ formatCurrency(receipt.managementFee + receipt.parkingFee) }}
                    </td>
                  </tr>
                  <tr v-if="receipt.serviceFee > 0">
                    <td class="py-2.5 pr-3 font-medium">Dịch vụ phát sinh</td>
                    <td class="px-3 py-2.5 text-muted">Đã nghiệm thu trong kỳ</td>
                    <td class="py-2.5 pl-3 text-right font-semibold tabular-nums">
                      {{ formatCurrency(receipt.serviceFee) }}
                    </td>
                  </tr>
                  <tr v-if="receipt.previousDebt > 0">
                    <td class="py-2.5 pr-3 font-medium text-primary">Nợ cũ chuyển sang</td>
                    <td class="px-3 py-2.5 text-muted">Chưa thanh toán kỳ trước</td>
                    <td class="py-2.5 pl-3 text-right font-semibold text-primary tabular-nums">
                      {{ formatCurrency(receipt.previousDebt) }}
                    </td>
                  </tr>
                  <tr v-if="receipt.lateFee > 0">
                    <td class="py-2.5 pr-3 font-medium text-primary">Phí trễ hạn</td>
                    <td class="px-3 py-2.5 text-muted">Quá hạn thanh toán</td>
                    <td class="py-2.5 pl-3 text-right font-semibold text-primary tabular-nums">
                      {{ formatCurrency(receipt.lateFee) }}
                    </td>
                  </tr>
                  <tr v-if="receipt.discountAmount > 0">
                    <td class="py-2.5 pr-3 font-medium text-status-available">Giảm trừ ưu đãi</td>
                    <td class="px-3 py-2.5 text-muted">Theo hợp đồng</td>
                    <td class="py-2.5 pl-3 text-right font-semibold text-status-available tabular-nums">
                      -{{ formatCurrency(receipt.discountAmount) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="border-t border-gold/60 bg-surface-alt/50">
                    <td colspan="2" class="px-3 py-3 text-right font-serif font-bold text-ink">
                      Tổng cộng hóa đơn:
                    </td>
                    <td class="py-3 pl-3 text-right font-serif text-lg font-bold text-primary tabular-nums">
                      {{ formatCurrency(receipt.totalAmount) }}
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" class="px-3 py-2 text-right text-xs text-muted">Đã thanh toán / Còn lại:</td>
                    <td class="py-2 pl-3 text-right text-xs font-semibold tabular-nums">
                      <span class="text-status-available">{{ formatCurrency(receipt.paidAmount) }}</span> /
                      <span class="text-primary">{{ formatCurrency(receipt.remainingAmount) }}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Printer, X } from 'lucide-vue-next';
import { formatCurrency } from '@/utils/format';

defineProps({
  open: Boolean,
  receipt: { type: Object, default: null },
  building: { type: Object, default: null },
});

defineEmits(['close']);

function printDoc() {
  window.print();
}
</script>
