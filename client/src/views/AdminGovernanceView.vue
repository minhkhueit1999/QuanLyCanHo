<template>
  <div class="space-y-6">
    <!-- Admin Tabs -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex flex-wrap rounded-full border border-hairline bg-surface p-1 shadow-sm">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer"
          :class="activeTab === t.id ? 'bg-primary text-white' : 'text-muted hover:text-ink'"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <button
        v-if="activeTab === 'buildings'"
        type="button"
        class="btn-primary-pill px-4 py-2 text-xs"
        @click="openBuildingModal()"
      >
        <Plus class="h-3.5 w-3.5" />
        <span>Thêm Tòa nhà (34 Tỉnh/Thành)</span>
      </button>
      <button
        v-else-if="activeTab === 'staff'"
        type="button"
        class="btn-primary-pill px-4 py-2 text-xs"
        @click="openStaffModal()"
      >
        <UserPlus class="h-3.5 w-3.5" />
        <span>Tạo Manager / Sub-Admin</span>
      </button>
      <button
        v-else
        type="button"
        class="btn-gold-pill px-4 py-2 text-xs"
        @click="runSchedulerNow"
      >
        <Clock class="h-3.5 w-3.5" />
        <span>Chạy Scheduler Quét lịch ngay</span>
      </button>
    </div>

    <!-- TAB 1: BUILDINGS & MANAGER HANDOVER -->
    <div v-if="activeTab === 'buildings'" class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div
        v-for="b in workspaceStore.buildings"
        :key="b._id"
        class="card-canho neo-lattice flex flex-col justify-between p-5"
      >
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <h2 class="font-serif text-lg font-bold text-ink">{{ b.name }}</h2>
              <p class="text-xs text-muted">{{ b.address }} ({{ b.ward_name }}, {{ b.province_name }})</p>
            </div>
            <span class="rounded-full bg-wood-deep px-2.5 py-0.5 text-[11px] font-bold text-gold">
              {{ b.totalFloors }} tầng
            </span>
          </div>

          <div class="mt-3 rounded-xs bg-surface-alt/70 p-3 text-xs space-y-1">
            <p>
              Manager chính:
              <strong class="text-primary">{{ b.primaryManagerId?.fullName || 'Chưa phân công' }}</strong>
            </p>
            <p class="text-muted tabular-nums">
              Điện: {{ formatCurrency(b.pricingConfig?.electricityPrice) }} • Nước:
              {{ formatCurrency(b.pricingConfig?.waterPrice) }} • Hoa hồng:
              {{ b.commissionConfig?.defaultCommissionRate }}%
            </p>
          </div>

          <div v-if="b.managerHandoverHistory?.length" class="mt-3 text-[11px] text-muted">
            <p class="font-semibold text-ink">Biên bản bàn giao gần nhất:</p>
            <p>
              {{ formatDateTime(b.managerHandoverHistory[b.managerHandoverHistory.length - 1].handedOverAt) }}
              — {{ b.managerHandoverHistory[b.managerHandoverHistory.length - 1].keysSummary }}
              (Nợ chưa thu:
              {{ formatCurrency(b.managerHandoverHistory[b.managerHandoverHistory.length - 1].unpaidDebtTotal) }})
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
          <button type="button" class="btn-gold-pill px-3 py-1 text-xs" @click="openHandoverModal(b)">
            Bàn giao Manager chính
          </button>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-secondary-pill px-3 py-1 text-xs" @click="openBuildingModal(b)">Sửa</button>
            <button
              type="button"
              class="rounded-full border border-primary/40 px-3 py-1 text-xs text-primary hover:bg-primary hover:text-white cursor-pointer"
              @click="deleteBld(b)"
            >
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: STAFF (MANAGER & SUB-ADMIN) -->
    <div v-else-if="activeTab === 'staff'" class="card-canho p-5">
      <h2 class="mb-3 font-serif text-lg font-bold text-ink">
        Đội ngũ Nhân sự (Manager &amp; Sub-Admin)
      </h2>
      <p v-if="staffList.length === 0" class="text-sm text-muted">Chưa có nhân sự nào được tạo.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-hairline uppercase text-muted">
              <th class="py-2.5">Họ tên / Email</th>
              <th class="px-3 py-2.5">Vai trò</th>
              <th class="px-3 py-2.5">Phạm vi Tòa nhà / Hạn mức tiền mặt</th>
              <th class="py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-hairline">
            <tr v-for="m in staffList" :key="m._id">
              <td class="py-3">
                <p class="font-semibold">{{ m.fullName }}</p>
                <p class="text-muted">{{ m.email }}</p>
              </td>
              <td class="px-3 py-3">
                <span class="rounded-full bg-gold-tint px-2.5 py-0.5 font-semibold text-ink">
                  {{ m.role === 'admin' ? `Sub-Admin (${SUBROLE_LABELS[m.subRole] || m.subRole})` : 'Manager' }}
                </span>
              </td>
              <td class="px-3 py-3">
                <div v-if="m.role === 'manager'">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="b in m.assignedBuildings || []"
                      :key="b._id"
                      class="rounded-full border border-hairline bg-surface-alt px-2 py-0.5 text-[11px]"
                    >
                      {{ b.name }}
                    </span>
                  </div>
                  <p class="mt-1 text-muted tabular-nums">
                    Hạn mức tiền mặt: {{ formatCurrency(m.managerConfig?.cashLimit || 50000000) }}
                  </p>
                </div>
                <span v-else class="text-muted">Phân quyền con toàn Workspace</span>
              </td>
              <td class="py-3 text-right">
                <div class="inline-flex gap-2">
                  <button type="button" class="btn-secondary-pill px-3 py-1 text-[11px]" @click="openStaffModal(m)">
                    Phân quyền
                  </button>
                  <button
                    type="button"
                    class="rounded-full border border-primary/40 px-3 py-1 text-[11px] text-primary hover:bg-primary hover:text-white cursor-pointer"
                    @click="removeStaff(m)"
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: SENSITIVE APPROVALS & AUDIT LOGS -->
    <div v-else class="space-y-5">
      <!-- Pending Rooms Approval + Wrong Code Payments -->
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="card-gold p-5">
          <h3 class="font-serif text-base font-bold text-ink">
            Phòng chờ duyệt lên sàn ({{ pendingRooms.length }})
          </h3>
          <p v-if="pendingRooms.length === 0" class="mt-2 text-xs text-muted">
            Không có phòng nào đang chờ duyệt tại tòa nhà hiện tại.
          </p>
          <ul v-else class="mt-3 divide-y divide-hairline text-xs">
            <li v-for="r in pendingRooms" :key="r._id" class="flex items-center justify-between py-2.5">
              <div>
                <strong>Phòng {{ r.roomCode }}</strong> • Giá đề xuất: {{ formatCurrency(r.proposedPrice || r.base_price) }}
              </div>
              <button type="button" class="btn-primary-pill px-3 py-1 text-[11px]" @click="approvePendingRoom(r)">
                Duyệt lên sàn
              </button>
            </li>
          </ul>
        </div>

        <div class="card-gold p-5">
          <h3 class="font-serif text-base font-bold text-ink">
            Giao dịch sai mã chờ đối soát ({{ pendingPayments.length }})
          </h3>
          <p v-if="pendingPayments.length === 0" class="mt-2 text-xs text-muted">
            Không có giao dịch chuyển khoản sai mã nào chờ xử lý.
          </p>
          <ul v-else class="mt-3 divide-y divide-hairline text-xs">
            <li v-for="p in pendingPayments" :key="p._id" class="flex items-center justify-between py-2.5">
              <div>
                <strong>{{ p.transactionCode }}</strong> • {{ formatCurrency(p.amount) }}
              </div>
              <button type="button" class="btn-primary-pill px-3 py-1 text-[11px]" @click="reconcilePay(p)">
                Xác nhận khớp
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Audit Logs -->
      <div class="card-canho p-5">
        <h2 class="mb-3 font-serif text-lg font-bold text-ink">
          Nhật ký Kiểm toán Hành động Nhạy cảm (Audit Logs)
        </h2>
        <p v-if="auditLogs.length === 0" class="text-sm text-muted">Chưa có nhật ký kiểm toán nào.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr class="border-b border-hairline uppercase text-muted">
                <th class="py-2.5">Thời gian</th>
                <th class="px-3 py-2.5">Người thực hiện</th>
                <th class="px-3 py-2.5">Hành động</th>
                <th class="px-3 py-2.5">Tòa nhà / Lý do</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-hairline">
              <tr v-for="l in auditLogs" :key="l._id">
                <td class="py-2.5 tabular-nums text-muted">{{ formatDateTime(l.createdAt) }}</td>
                <td class="px-3 py-2.5 font-semibold">{{ l.actorName }} ({{ l.actorRole }})</td>
                <td class="px-3 py-2.5">
                  <span class="rounded-full bg-primary-tint px-2.5 py-0.5 font-bold text-primary">{{ l.action }}</span>
                </td>
                <td class="px-3 py-2.5 text-muted">
                  {{ l.building_id?.name ? `[${l.building_id.name}] ` : '' }}{{ l.reason }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Building Modal -->
    <Teleport to="body">
      <div
        v-if="bldModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="bldModal.open = false"
      >
        <div class="card-gold neo-lattice max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
          <h3 class="font-serif text-xl font-bold text-ink">
            {{ bldModal.id ? 'Cập nhật Tòa nhà' : 'Thêm Tòa nhà mới' }}
          </h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitBuilding">
            <div>
              <label for="ab-name" class="mb-1 block text-xs font-semibold">Tên tòa nhà</label>
              <input id="ab-name" v-model="bldModal.name" type="text" required class="input-canho" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="ab-prov" class="mb-1 block text-xs font-semibold">Tỉnh/Thành (34 đơn vị)</label>
                <select id="ab-prov" v-model="bldModal.province_code" required class="input-canho" @change="onBldProvChange">
                  <option v-for="d in workspaceStore.divisions" :key="d.admin_code" :value="d.admin_code">{{ d.name }}</option>
                </select>
              </div>
              <div>
                <label for="ab-ward" class="mb-1 block text-xs font-semibold">
                  Phường/Xã ({{ bldWards.length }} đơn vị)
                </label>
                <select id="ab-ward" v-model="bldModal.ward_code" required class="input-canho">
                  <option v-for="w in bldWards" :key="w.ward_code" :value="w.ward_code">{{ w.name }}</option>
                </select>
              </div>
            </div>
            <div>
              <label for="ab-addr" class="mb-1 block text-xs font-semibold">Địa chỉ</label>
              <input id="ab-addr" v-model="bldModal.address" type="text" required class="input-canho" />
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="ab-fl" class="mb-1 block text-xs font-semibold">Số tầng</label>
                <input id="ab-fl" v-model.number="bldModal.totalFloors" type="number" min="1" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="ab-el" class="mb-1 block text-xs font-semibold">Giá điện</label>
                <input id="ab-el" v-model.number="bldModal.electricityPrice" type="number" min="0" class="input-canho tabular-nums" />
              </div>
              <div>
                <label for="ab-wa" class="mb-1 block text-xs font-semibold">Giá nước</label>
                <input id="ab-wa" v-model.number="bldModal.waterPrice" type="number" min="0" class="input-canho tabular-nums" />
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="bldModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Lưu Tòa nhà</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Handover Primary Manager Modal -->
    <Teleport to="body">
      <div
        v-if="handoverModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="handoverModal.open = false"
      >
        <div class="card-gold w-full max-w-md p-6">
          <h3 class="font-serif text-lg font-bold text-ink">
            Bàn giao Manager chính — {{ handoverModal.building?.name }}
          </h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitHandover">
            <div>
              <label for="ho-mgr" class="mb-1 block text-xs font-semibold">Chọn Manager nhận bàn giao</label>
              <select id="ho-mgr" v-model="handoverModal.newManagerId" required class="input-canho">
                <option v-for="m in managerOnlyList" :key="m._id" :value="m._id">
                  {{ m.fullName }} ({{ m.email }})
                </option>
              </select>
            </div>
            <div>
              <label for="ho-note" class="mb-1 block text-xs font-semibold">Ghi chú biên bản</label>
              <input id="ho-note" v-model="handoverModal.note" type="text" class="input-canho" placeholder="Bàn giao chìa khóa, công nợ & tiền mặt" />
            </div>
            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="handoverModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Lập biên bản &amp; Bàn giao</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Staff Modal -->
    <Teleport to="body">
      <div
        v-if="staffModal.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-wood-deep/60 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click.self="staffModal.open = false"
      >
        <div class="card-gold neo-lattice max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
          <h3 class="font-serif text-xl font-bold text-ink">
            {{ staffModal.id ? 'Cập nhật nhân sự' : 'Tạo nhân sự (Manager / Sub-Admin)' }}
          </h3>
          <form class="mt-4 space-y-3" @submit.prevent="submitStaff">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="stf-role" class="mb-1 block text-xs font-semibold">Vai trò</label>
                <select id="stf-role" v-model="staffModal.role" :disabled="Boolean(staffModal.id)" class="input-canho">
                  <option value="manager">Manager Tòa nhà</option>
                  <option value="admin">Sub-Admin (Phân quyền con)</option>
                </select>
              </div>
              <div v-if="staffModal.role === 'admin'">
                <label for="stf-sub" class="mb-1 block text-xs font-semibold">Quyền con Sub-Admin</label>
                <select id="stf-sub" v-model="staffModal.subRole" class="input-canho">
                  <option value="operations">Vận hành (Operations)</option>
                  <option value="accountant">Kế toán (Accountant)</option>
                  <option value="customer_care">CSKH (Customer Care)</option>
                </select>
              </div>
              <div v-else>
                <label for="stf-limit" class="mb-1 block text-xs font-semibold">Hạn mức tiền mặt (VNĐ)</label>
                <input id="stf-limit" v-model.number="staffModal.cashLimit" type="number" step="1000000" class="input-canho tabular-nums" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="stf-name" class="mb-1 block text-xs font-semibold">Họ và tên</label>
                <input id="stf-name" v-model="staffModal.fullName" type="text" required class="input-canho" />
              </div>
              <div>
                <label for="stf-email" class="mb-1 block text-xs font-semibold">Email</label>
                <input id="stf-email" v-model="staffModal.email" type="email" required :disabled="Boolean(staffModal.id)" class="input-canho" />
              </div>
            </div>

            <div>
              <label for="stf-pass" class="mb-1 block text-xs font-semibold">
                {{ staffModal.id ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu' }}
              </label>
              <input id="stf-pass" v-model="staffModal.password" type="password" :required="!staffModal.id" minlength="6" class="input-canho" />
            </div>

            <div v-if="staffModal.role === 'manager'">
              <p class="mb-1.5 text-xs font-semibold">Tòa nhà được phân công:</p>
              <div class="max-h-40 space-y-1.5 overflow-y-auto rounded-xs border border-hairline bg-canvas/50 p-2.5">
                <label v-for="b in workspaceStore.buildings" :key="b._id" class="flex items-center gap-2 text-xs cursor-pointer">
                  <input v-model="staffModal.assignedBuildings" type="checkbox" :value="b._id" class="h-4 w-4 accent-primary" />
                  <span>{{ b.name }}</span>
                </label>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3">
              <button type="button" class="btn-secondary-pill" @click="staffModal.open = false">Hủy</button>
              <button type="submit" class="btn-primary-pill">Lưu nhân sự</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus, UserPlus, Clock } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, formatDateTime, SUBROLE_LABELS } from '@/utils/format';

const workspaceStore = useWorkspaceStore();
const toastStore = useToastStore();

const activeTab = ref('buildings');
const tabs = [
  { id: 'buildings', label: 'Tòa nhà & Bàn giao Manager' },
  { id: 'staff', label: 'Nhân sự & Phân quyền' },
  { id: 'audit', label: 'Duyệt nhạy cảm & Audit Log' },
];

const staffList = ref([]);
const auditLogs = ref([]);
const pendingRooms = ref([]);
const pendingPayments = ref([]);

const managerOnlyList = computed(() => staffList.value.filter((s) => s.role === 'manager'));

const bldModal = reactive({
  open: false,
  id: '',
  name: '',
  address: '',
  province_code: '79',
  ward_code: '26740',
  totalFloors: 5,
  electricityPrice: 3500,
  waterPrice: 20000,
});

const bldWards = computed(() => {
  const div = workspaceStore.divisions.find((d) => d.admin_code === bldModal.province_code);
  return div ? div.wards || [] : [];
});

const handoverModal = reactive({ open: false, building: null, newManagerId: '', note: '' });

const staffModal = reactive({
  open: false,
  id: '',
  role: 'manager',
  subRole: 'operations',
  fullName: '',
  email: '',
  password: '',
  cashLimit: 50000000,
  assignedBuildings: [],
});

function onBldProvChange() {
  bldModal.ward_code = bldWards.value[0]?.ward_code || '';
}

function openBuildingModal(b = null) {
  if (b) {
    bldModal.id = b._id;
    bldModal.name = b.name;
    bldModal.address = b.address;
    bldModal.province_code = b.province_code;
    bldModal.ward_code = b.ward_code;
    bldModal.totalFloors = b.totalFloors;
    bldModal.electricityPrice = b.pricingConfig?.electricityPrice || 3500;
    bldModal.waterPrice = b.pricingConfig?.waterPrice || 20000;
  } else {
    bldModal.id = '';
    bldModal.name = '';
    bldModal.address = '';
    bldModal.province_code =
      workspaceStore.divisions.find((d) => d.admin_code === '79')?.admin_code ||
      workspaceStore.divisions[0]?.admin_code ||
      '';
    bldModal.ward_code = bldWards.value[0]?.ward_code || '';
    bldModal.totalFloors = 5;
    bldModal.electricityPrice = 3500;
    bldModal.waterPrice = 20000;
  }
  bldModal.open = true;
}

async function submitBuilding() {
  try {
    const payload = {
      name: bldModal.name,
      address: bldModal.address,
      province_code: bldModal.province_code,
      ward_code: bldModal.ward_code,
      totalFloors: bldModal.totalFloors,
      pricingConfig: {
        electricityPrice: bldModal.electricityPrice,
        waterPrice: bldModal.waterPrice,
      },
    };
    if (bldModal.id) {
      await workspaceStore.updateBuilding(bldModal.id, payload);
      toastStore.success('Đã cập nhật tòa nhà');
    } else {
      await workspaceStore.createBuilding(payload);
      toastStore.success('Đã tạo tòa nhà mới');
    }
    bldModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function deleteBld(b) {
  try {
    await workspaceStore.deleteBuilding(b._id);
    toastStore.success(`Đã xóa tòa nhà "${b.name}"`);
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openHandoverModal(b) {
  handoverModal.building = b;
  handoverModal.newManagerId = managerOnlyList.value[0]?._id || '';
  handoverModal.note = '';
  handoverModal.open = true;
}

async function submitHandover() {
  try {
    await api.post(`/buildings/${handoverModal.building._id}/handover-manager`, {
      newManagerId: handoverModal.newManagerId,
      note: handoverModal.note,
    });
    toastStore.success('Đã lập biên bản bàn giao Manager chính');
    handoverModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

function openStaffModal(m = null) {
  if (m) {
    staffModal.id = m._id;
    staffModal.role = m.role;
    staffModal.subRole = m.subRole || 'operations';
    staffModal.fullName = m.fullName;
    staffModal.email = m.email;
    staffModal.password = '';
    staffModal.cashLimit = m.managerConfig?.cashLimit || 50000000;
    staffModal.assignedBuildings = (m.assignedBuildings || []).map((b) =>
      typeof b === 'string' ? b : b._id
    );
  } else {
    staffModal.id = '';
    staffModal.role = 'manager';
    staffModal.subRole = 'operations';
    staffModal.fullName = '';
    staffModal.email = '';
    staffModal.password = '';
    staffModal.cashLimit = 50000000;
    staffModal.assignedBuildings = workspaceStore.currentBuildingId
      ? [workspaceStore.currentBuildingId]
      : [];
  }
  staffModal.open = true;
}

async function submitStaff() {
  try {
    if (staffModal.id) {
      await api.put(`/staff/${staffModal.id}`, {
        fullName: staffModal.fullName,
        password: staffModal.password || undefined,
        subRole: staffModal.subRole,
        cashLimit: staffModal.cashLimit,
        assignedBuildings: staffModal.assignedBuildings,
      });
      toastStore.success('Đã cập nhật nhân sự');
    } else {
      await api.post('/staff', { ...staffModal });
      toastStore.success('Đã tạo nhân sự mới');
    }
    staffModal.open = false;
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function removeStaff(m) {
  try {
    await api.delete(`/staff/${m._id}`);
    toastStore.success(`Đã xóa "${m.fullName}"`);
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function approvePendingRoom(r) {
  try {
    await api.patch(`/rooms/${r._id}/approve`, {
      approvedPrice: r.proposedPrice || r.base_price,
      approvalNote: 'Duyệt tại trung tâm quản trị Admin',
    });
    toastStore.success(`Đã duyệt phòng ${r.roomCode} lên sàn`);
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function reconcilePay(p) {
  try {
    await api.patch(`/payments/${p._id}/reconcile`, { action: 'confirm' });
    toastStore.success(`Đã đối soát giao dịch ${p.transactionCode}`);
    await loadAll();
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function runSchedulerNow() {
  try {
    const res = await api.post('/dashboard/run-scheduler');
    toastStore.success(
      `Scheduler hoàn tất: ${res.data.data.expiredDeposits} cọc hết hạn, ${res.data.data.invoicesMarkedOverdue} HĐ quá hạn`
    );
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

async function loadAll() {
  try {
    const [, , stRes, logRes] = await Promise.all([
      workspaceStore.fetchBuildings(),
      workspaceStore.fetchDivisions(),
      api.get('/staff'),
      api.get('/dashboard/audit-logs'),
    ]);
    staffList.value = stRes.data.data || [];
    auditLogs.value = logRes.data.data || [];

    if (workspaceStore.currentBuildingId) {
      const [rmRes, pyRes] = await Promise.all([
        api.get('/rooms', { params: { approvalStatus: 'pending' } }),
        api.get('/payments/building'),
      ]);
      pendingRooms.value = rmRes.data.data || [];
      pendingPayments.value = (pyRes.data.data || []).filter((p) => p.status === 'pending');
    }
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

onMounted(loadAll);
</script>
