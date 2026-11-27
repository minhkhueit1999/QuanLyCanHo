<template>
  <div class="space-y-6">
    <div class="card-canho p-5">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-serif text-lg font-bold text-ink">
            Hợp đồng thuê &amp; Biên bản bàn giao ({{ bookingBillingStore.contracts.length }})
          </h2>
          <p class="text-xs text-muted">
            Liên kết phiếu cọc, kiểm tra maxOccupants, phương tiện, ký điện tử/bản ký, đổi phòng, chuyển nhượng &amp; quyết toán trả phòng
          </p>
        </div>
        <button type="button" class="btn-primary-pill px-4 py-2 text-xs" @click="openNewContract">
          <Plus class="h-3.5 w-3.5" />
          <span>Ký Hợp đồng &amp; Bàn giao</span>
        </button>
      </div>

      <p v-if="bookingBillingStore.contracts.length === 0" class="text-sm text-muted">
        Chưa có hợp đồng nào trong tòa nhà này.
      </p>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Mã HĐ</th>
              <th class="px-3 py-2.5">Phòng, Nhân khẩu &amp; Xe</th>
              <th class="px-3 py-2.5 text-right">Giá thuê / Cọc</th>
              <th class="px-3 py-2.5">Thời hạn &amp; Ký điện tử</th>
              <th class="px-3 py-2.5">Trạng thái</th>
              <th class="py-2.5 text-right">Nghiệp vụ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="c in bookingBillingStore.contracts" :key="c._id">
              <td class="py-3 font-semibold">{{ c.contractCode }}</td>
              <td class="px-3 py-3">
                <p class="font-bold">Phòng {{ c.room_id?.roomCode }} (Tối đa {{ c.room_id?.maxOccupants || 2 }} người)</p>
                <p class="text-muted">
                  {{ (c.occupants || []).map((o) => o.fullName).join(', ') }}
                </p>
                <p class="text-muted">
                  Xe: {{ (c.vehicles || []).map((v) => `${v.type === 'car' ? 'Ô tô' : 'Xe máy'} ${v.plateNumber}`).join(', ') || 'Không có' }}
                </p>
              </td>
              <td class="px-3 py-3 text-right tabular-nums">
                <p class="font-semibold text-primary">{{ formatCurrency(c.monthlyRent) }}</p>
                <p class="text-muted">Cọc: {{ formatCurrency(c.depositAmount) }}</p>
              </td>
              <td class="px-3 py-3 tabular-nums">
                <p>{{ formatDate(c.startDate) }} → {{ formatDate(c.endDate) }}</p>
                <p class="text-muted">Ký: {{ c.signatureText || 'Đã ký' }}</p>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-full bg-surface-alt px-2.5 py-0.5 font-semibold">{{ c.status }}</span>
                <p v-if="c.status === 'terminated' && c.settlement" class="mt-1 font-semibold text-status-available">
                  Hoàn cọc ròng: {{ formatCurrency(c.settlement.netRefund) }}
                </p>
              </td>
              <td class="py-3 text-right">
                <div v-if="['active', 'checkout_requested'].includes(c.status)" class="inline-flex flex-wrap justify-end gap-1.5">
                  <button type="button" class="btn-secondary-pill px-2.5 py-1 text-[11px]" @click="openOccVehModal(c)">
                    Nhân khẩu/Xe
                  </button>
                  <button type="button" class="btn-secondary-pill px-2.5 py-1 text-[11px]" @click="openExtendModal(c)">
                    Gia hạn
                  </button>
                  <button type="button" class="btn-secondary-pill px-2.5 py-1 text-[11px]" @click="openChangeRoom(c)">
                    Đổi phòng
                  </button>
                  <button type="button" class="btn-gold-pill px-2.5 py-1 text-[11px]" @click="openTransferModal(c)">
                    Chuyển nhượng
                  </button>
                  <button type="button" class="btn-primary-pill px-2.5 py-1 text-[11px]" @click="openSettle(c)">
                    Quyết toán trả
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Contract Modal -->
    <Teleport to="body">
      <div
        v-if="createModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="createModal.open = false"
      >
        <div class="card-gold neo-lattice max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
          <h3 class="font-serif text-xl font-bold text-ink">Ký Hợp đồng &amp; Biên bản bàn giao</h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitCreate">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label for="ct-dep-link" class="mb-1 block text-xs font-semibold">Gắn phiếu cọc đang giữ (tùy chọn)</label>
                <select id="ct-dep-link" v-model="createModal.deposit_id" class="input-canho" @change="onSelectDeposit">
                  <option value="">-- Không gắn cọc --</option>
                  <option v-for="d in heldDeposits" :key="d._id" :value="d._id">
                    {{ d.depositCode }} • P{{ d.room_id?.roomCode }} ({{ formatCurrency(d.amount) }})
                  </option>
                </select>
              </div>
              <div>
                <label for="ct-room" class="mb-1 block text-xs font-semibold">Phòng</label>
                <select id="ct-room" v-model="createModal.room_id" required class="input-canho">
                  <option v-for="r in selectableRooms" :key="r._id" :value="r._id">
                    P{{ r.roomCode }} (Tối đa {{ r.maxOccupants }} người) - {{ formatCurrency(r.base_price) }}
                  </option>
                </select>
              </div>
              <div>
                <label for="ct-email" class="mb-1 block text-xs font-semibold">Email tài khoản Cư dân</label>
                <input id="ct-email" v-model="createModal.userEmail" type="email" required placeholder="cudan@canho.com" class="input-canho" />
              </div>
            </div>

            <!-- Occupants List -->
            <div class="rounded-xs border border-hairline bg-canvas/50 p-3 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-ink">Danh sách nhân khẩu ({{ createModal.occupants.length }})</span>
                <button type="button" class="text-xs font-semibold text-primary hover:underline cursor-pointer" @click="addOccupant">
                  + Thêm người ở cùng
                </button>
              </div>
              <div v-for="(occ, idx) in createModal.occupants" :key="idx" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input v-model="occ.fullName" type="text" required placeholder="Họ tên" class="input-canho py-1.5 text-xs" />
                <input v-model="occ.phone" type="tel" required placeholder="Số ĐT" class="input-canho py-1.5 text-xs tabular-nums" />
                <input v-model="occ.idCard" type="text" required placeholder="Số CCCD" class="input-canho py-1.5 text-xs tabular-nums" />
              </div>
            </div>

            <!-- Vehicles -->
            <div class="rounded-xs border border-hairline bg-canvas/50 p-3 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-ink">Phương tiện đăng ký ({{ createModal.vehicles.length }})</span>
                <button type="button" class="text-xs font-semibold text-primary hover:underline cursor-pointer" @click="addVehicle">
                  + Thêm biển số xe
                </button>
              </div>
              <div v-for="(v, idx) in createModal.vehicles" :key="idx" class="grid grid-cols-2 gap-2">
                <select v-model="v.type" class="input-canho py-1.5 text-xs">
                  <option value="motorbike">Xe máy</option>
                  <option value="car">Ô tô</option>
                </select>
                <input v-model="v.plateNumber" type="text" placeholder="Biển số (VD: 59C1-12345)" class="input-canho py-1.5 text-xs uppercase" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="ct-rent" class="mb-1 block text-xs font-semibold">Giá thuê/tháng</label>
                <input id="ct-rent" v-model.number="createModal.monthlyRent" type="number" step="100000" required class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="ct-disc" class="mb-1 block text-xs font-semibold">Giảm giá (VNĐ)</label>
                <input id="ct-disc" v-model.number="createModal.discountAmount" type="number" min="0" step="50000" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="ct-dep" class="mb-1 block text-xs font-semibold">Tiền cọc (VNĐ)</label>
                <input id="ct-dep" v-model.number="createModal.depositAmount" type="number" min="0" step="100000" class="input-canho tabular-nums" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label for="ct-start" class="mb-1 block text-xs font-semibold">Ngày bắt đầu</label>
                <input id="ct-start" v-model="createModal.startDate" type="date" required class="input-canho text-xs" />
              </div>
              <div>
                <label for="ct-end" class="mb-1 block text-xs font-semibold">Ngày kết thúc</label>
                <input id="ct-end" v-model="createModal.endDate" type="date" required class="input-canho text-xs" />
              </div>
              <div>
                <label for="ct-elec" class="mb-1 block text-xs font-semibold">Điện đầu</label>
                <input id="ct-elec" v-model.number="createModal.elecInitial" type="number" min="0" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="ct-water" class="mb-1 block text-xs font-semibold">Nước đầu</label>
                <input id="ct-water" v-model.number="createModal.waterInitial" type="number" min="0" class="input-canho tabular-nums" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="ct-sig" class="mb-1 block text-xs font-semibold">Chữ ký điện tử (Họ tên xác nhận)</label>
                <input id="ct-sig" v-model="createModal.signatureText" type="text" placeholder="Ký tên xác nhận" class="input-canho" />
              </div>
              <div>
                <label for="ct-doc" class="mb-1 block text-xs font-semibold">Link bản ký PDF/Ảnh (tùy chọn)</label>
                <input id="ct-doc" v-model="createModal.signedDocumentUrl" type="text" placeholder="https://..." class="input-canho" />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="createModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill" :disabled="submitting">Kích hoạt Hợp đồng</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Checkout Settlement Modal -->
    <Teleport to="body">
      <div
        v-if="settleModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="settleModal.open = false"
      >
        <div class="card-gold neo-lattice w-full max-w-md p-6">
          <h3 class="font-serif text-xl font-bold text-ink">Quyết toán trả phòng — {{ settleModal.contract?.contractCode }}</h3>
          <p class="mt-1 text-xs text-muted">
            Tiền cọc - Nợ cũ - (Điện/nước/phí kỳ cuối) - Bồi thường hư hỏng
          </p>
          <form class="mt-4 space-y-3" @submit.prevent="submitSettlement">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="st-eo" class="mb-1 block text-xs font-semibold">Điện cũ</label>
                <input id="st-eo" v-model.number="settleModal.finalElecOld" type="number" min="0" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="st-en" class="mb-1 block text-xs font-semibold">Điện cuối</label>
                <input id="st-en" v-model.number="settleModal.finalElecNew" type="number" min="0" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="st-wo" class="mb-1 block text-xs font-semibold">Nước cũ</label>
                <input id="st-wo" v-model.number="settleModal.finalWaterOld" type="number" min="0" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="st-wn" class="mb-1 block text-xs font-semibold">Nước cuối</label>
                <input id="st-wn" v-model.number="settleModal.finalWaterNew" type="number" min="0" class="input-canho tabular-nums" />
              </div>
            </div>
            <div>
              <label for="st-dmg" class="mb-1 block text-xs font-semibold">Bồi thường hư hỏng/mất mát (VNĐ)</label>
              <input id="st-dmg" v-model.number="settleModal.damageCompensation" type="number" min="0" step="50000" class="input-canho tabular-nums" />
            </div>
            <div>
              <label for="st-note" class="mb-1 block text-xs font-semibold">Ghi chú kiểm tra phòng</label>
              <input id="st-note" v-model="settleModal.note" type="text" class="input-canho" />
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="settleModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Hoàn tất quyết toán</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Occupants / Vehicles Edit Modal -->
    <Teleport to="body">
      <div
        v-if="occVehModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="occVehModal.open = false"
      >
        <div class="card-gold w-full max-w-lg p-6">
          <h3 class="font-serif text-lg font-bold text-ink">Cập nhật Nhân khẩu &amp; Xe</h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitOccVeh">
            <div class="space-y-2">
              <div class="flex justify-between text-xs font-bold">
                <span>Nhân khẩu</span>
                <button type="button" class="text-primary cursor-pointer" @click="occVehModal.occupants.push({ fullName: '', phone: '', idCard: '' })">+ Thêm người</button>
              </div>
              <div v-for="(o, idx) in occVehModal.occupants" :key="idx" class="grid grid-cols-3 gap-2">
                <input v-model="o.fullName" type="text" required placeholder="Họ tên" class="input-canho py-1.5 text-xs" />
                <input v-model="o.phone" type="tel" required placeholder="SĐT" class="input-canho py-1.5 text-xs" />
                <input v-model="o.idCard" type="text" required placeholder="CCCD" class="input-canho py-1.5 text-xs" />
              </div>
            </div>
            <div class="space-y-2 border-t border-hairline pt-2">
              <div class="flex justify-between text-xs font-bold">
                <span>Xe</span>
                <button type="button" class="text-primary cursor-pointer" @click="occVehModal.vehicles.push({ type: 'motorbike', plateNumber: '' })">+ Thêm xe</button>
              </div>
              <div v-for="(v, idx) in occVehModal.vehicles" :key="idx" class="grid grid-cols-2 gap-2">
                <select v-model="v.type" class="input-canho py-1.5 text-xs">
                  <option value="motorbike">Xe máy</option>
                  <option value="car">Ô tô</option>
                </select>
                <input v-model="v.plateNumber" type="text" placeholder="Biển số" class="input-canho py-1.5 text-xs uppercase" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="occVehModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Change Room Modal -->
    <Teleport to="body">
      <div
        v-if="changeModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="changeModal.open = false"
      >
        <div class="card-gold w-full max-w-sm p-6">
          <h3 class="font-serif text-lg font-bold text-ink">Đổi phòng theo ngày thực tế</h3>
          <form class="mt-3 space-y-3" @submit.prevent="submitChangeRoom">
            <div>
              <label for="chg-room" class="mb-1 block text-xs font-semibold">Chọn phòng trống mới</label>
              <select id="chg-room" v-model="changeModal.newRoomId" required class="input-canho">
                <option v-for="r in availableRooms" :key="r._id" :value="r._id">
                  Phòng {{ r.roomCode }} - {{ formatCurrency(r.base_price) }}
                </option>
              </select>
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary-pill" @click="changeModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Xác nhận đổi phòng</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Extend Contract Modal -->
    <Teleport to="body">
      <div
        v-if="extendModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="extendModal.open = false"
      >
        <div class="card-gold w-full max-w-sm p-6">
          <h3 class="font-serif text-lg font-bold text-ink">Gia hạn Hợp đồng</h3>
          <form class="mt-3 space-y-3" @submit.prevent="submitExtend">
            <div>
              <label for="ex-date" class="mb-1 block text-xs font-semibold">Ngày kết thúc mới</label>
              <input id="ex-date" v-model="extendModal.newEndDate" type="date" required class="input-canho" />
            </div>
            <div>
              <label for="ex-rent" class="mb-1 block text-xs font-semibold">Giá thuê mới (VNĐ)</label>
              <input id="ex-rent" v-model.number="extendModal.newMonthlyRent" type="number" step="100000" class="input-canho tabular-nums" />
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary-pill" @click="extendModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Gia hạn</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Transfer Contract Modal -->
    <Teleport to="body">
      <div
        v-if="transferModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="transferModal.open = false"
      >
        <div class="card-gold w-full max-w-sm p-6">
          <h3 class="font-serif text-lg font-bold text-ink">Chuyển nhượng Hợp đồng</h3>
          <form class="mt-3 space-y-3" @submit.prevent="submitTransfer">
            <div>
              <label for="tr-email" class="mb-1 block text-xs font-semibold">Email người nhận chuyển nhượng</label>
              <input id="tr-email" v-model="transferModal.newUserEmail" type="email" required class="input-canho" />
            </div>
            <div>
              <label for="tr-name" class="mb-1 block text-xs font-semibold">Họ tên người nhận</label>
              <input id="tr-name" v-model="transferModal.fullName" type="text" required class="input-canho" />
            </div>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn-secondary-pill" @click="transferModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Chuyển nhượng</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Plus } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useWorkspaceStore } from '@/stores/workspace';
import { useBookingBillingStore } from '@/stores/bookingBilling';
import { useToastStore } from '@/stores/toast';
import { addMonthsInput, formatCurrency, formatDate, getTodayInput } from '@/utils/format';

const workspaceStore = useWorkspaceStore();
const bookingBillingStore = useBookingBillingStore();
const toastStore = useToastStore();

const rooms = ref([]);
const submitting = ref(false);

const heldDeposits = computed(() =>
  bookingBillingStore.deposits.filter((d) => d.status === 'held')
);
const availableRooms = computed(() => rooms.value.filter((r) => r.status === 'available'));
const selectableRooms = computed(() =>
  rooms.value.filter((r) => ['available', 'reserved'].includes(r.status))
);

const createModal = reactive({
  open: false,
  deposit_id: '',
  room_id: '',
  user_id: null,
  userEmail: '',
  occupants: [{ fullName: '', phone: '', idCard: '', isPrimary: true }],
  vehicles: [],
  monthlyRent: 5000000,
  discountAmount: 0,
  depositAmount: 5000000,
  startDate: getTodayInput(),
  endDate: addMonthsInput(12),
  elecInitial: 0,
  waterInitial: 0,
  signatureText: '',
  signedDocumentUrl: '',
});

const settleModal = reactive({
  open: false,
  contract: null,
  finalElecOld: 0,
  finalElecNew: 0,
  finalWaterOld: 0,
  finalWaterNew: 0,
  damageCompensation: 0,
  note: '',
});

const occVehModal = reactive({ open: false, contractId: '', occupants: [], vehicles: [] });
const changeModal = reactive({ open: false, contractId: '', newRoomId: '' });
const extendModal = reactive({ open: false, contractId: '', newEndDate: addMonthsInput(24), newMonthlyRent: 0 });
const transferModal = reactive({ open: false, contractId: '', newUserEmail: '', fullName: '' });

async function loadAll() {
  if (!workspaceStore.currentBuildingId) return;
  try {
    const [, rRes] = await Promise.all([
      bookingBillingStore.fetchBuildingLeasingData(),
      api.get('/rooms'),
    ]);
    rooms.value = rRes.data.data || [];
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function addOccupant() {
  createModal.occupants.push({ fullName: '', phone: '', idCard: '', isPrimary: false });
}

function addVehicle() {
  createModal.vehicles.push({ type: 'motorbike', plateNumber: '' });
}

function onSelectDeposit() {
  const dep = heldDeposits.value.find((d) => d._id === createModal.deposit_id);
  if (dep) {
    createModal.room_id = dep.room_id?._id || '';
    createModal.user_id = dep.user_id?._id || null;
    createModal.userEmail = dep.user_id?.email || '';
    createModal.depositAmount = dep.amount;
    createModal.monthlyRent = dep.room_id?.base_price || createModal.monthlyRent;
    createModal.occupants = [
      {
        fullName: dep.user_id?.fullName || '',
        phone: dep.user_id?.phone || '',
        idCard: '',
        isPrimary: true,
      },
    ];
  } else {
    createModal.user_id = null;
  }
}

function openNewContract() {
  const first = selectableRooms.value[0];
  createModal.deposit_id = '';
  createModal.room_id = first?._id || '';
  createModal.user_id = null;
  createModal.userEmail = '';
  createModal.occupants = [{ fullName: '', phone: '', idCard: '', isPrimary: true }];
  createModal.vehicles = [];
  createModal.monthlyRent = first?.base_price || 5000000;
  createModal.depositAmount = first?.base_price || 5000000;
  createModal.discountAmount = 0;
  createModal.signatureText = '';
  createModal.signedDocumentUrl = '';
  createModal.open = true;
}

async function submitCreate() {
  submitting.value = true;
  try {
    const res = await api.post('/contracts', {
      room_id: createModal.room_id,
      user_id: createModal.user_id,
      userEmail: createModal.userEmail,
      deposit_id: createModal.deposit_id || null,
      occupants: createModal.occupants,
      vehicles: createModal.vehicles.filter((v) => v.plateNumber.trim()),
      monthlyRent: createModal.monthlyRent,
      discountAmount: createModal.discountAmount,
      depositAmount: createModal.depositAmount,
      startDate: createModal.startDate,
      endDate: createModal.endDate,
      signatureText: createModal.signatureText,
      signedDocumentUrl: createModal.signedDocumentUrl,
      handover: {
        elecInitial: createModal.elecInitial,
        waterInitial: createModal.waterInitial,
      },
    });
    toastStore.success(res.data.message);
    createModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

function openSettle(c) {
  settleModal.contract = c;
  settleModal.finalElecOld = c.handover?.elecInitial || 0;
  settleModal.finalElecNew = c.handover?.elecInitial || 0;
  settleModal.finalWaterOld = c.handover?.waterInitial || 0;
  settleModal.finalWaterNew = c.handover?.waterInitial || 0;
  settleModal.damageCompensation = 0;
  settleModal.note = '';
  settleModal.open = true;
}

async function submitSettlement() {
  try {
    await api.post(`/contracts/${settleModal.contract._id}/settle-checkout`, {
      finalElecOld: settleModal.finalElecOld,
      finalElecNew: settleModal.finalElecNew,
      finalWaterOld: settleModal.finalWaterOld,
      finalWaterNew: settleModal.finalWaterNew,
      damageCompensation: settleModal.damageCompensation,
      note: settleModal.note,
    });
    toastStore.success('Đã hoàn tất quyết toán trả phòng');
    settleModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openOccVehModal(c) {
  occVehModal.contractId = c._id;
  occVehModal.occupants = JSON.parse(JSON.stringify(c.occupants || []));
  occVehModal.vehicles = JSON.parse(JSON.stringify(c.vehicles || []));
  occVehModal.open = true;
}

async function submitOccVeh() {
  try {
    await api.put(`/contracts/${occVehModal.contractId}/occupants-vehicles`, {
      occupants: occVehModal.occupants,
      vehicles: occVehModal.vehicles.filter((v) => v.plateNumber.trim()),
    });
    toastStore.success('Đã cập nhật nhân khẩu & phương tiện');
    occVehModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openChangeRoom(c) {
  changeModal.contractId = c._id;
  changeModal.newRoomId = availableRooms.value[0]?._id || '';
  changeModal.open = true;
}

async function submitChangeRoom() {
  try {
    const res = await api.post(`/contracts/${changeModal.contractId}/change-room`, {
      newRoomId: changeModal.newRoomId,
    });
    toastStore.success(res.data.message);
    changeModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openExtendModal(c) {
  extendModal.contractId = c._id;
  extendModal.newMonthlyRent = c.monthlyRent;
  extendModal.open = true;
}

async function submitExtend() {
  try {
    const res = await api.post(`/contracts/${extendModal.contractId}/extend`, {
      newEndDate: extendModal.newEndDate,
      newMonthlyRent: extendModal.newMonthlyRent,
    });
    toastStore.success(res.data.message);
    extendModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openTransferModal(c) {
  transferModal.contractId = c._id;
  transferModal.newUserEmail = '';
  transferModal.fullName = '';
  transferModal.open = true;
}

async function submitTransfer() {
  try {
    const res = await api.post(`/contracts/${transferModal.contractId}/transfer`, {
      newUserEmail: transferModal.newUserEmail,
      fullName: transferModal.fullName,
    });
    toastStore.success(res.data.message);
    transferModal.open = false;
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
