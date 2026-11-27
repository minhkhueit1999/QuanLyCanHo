<template>
  <div class="mx-auto max-w-3xl py-4">
    <div class="card-gold neo-lattice overflow-hidden">
      <div class="wood-lattice-bg px-6 py-6 text-white sm:px-8">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-0.5 text-xs font-medium text-gold">
          <Sparkles class="h-3.5 w-3.5" aria-hidden="true" />
          canho.com • Khởi tạo Workspace Độc lập
        </span>
        <h2 class="mt-2 font-serif text-2xl font-bold text-white">
          Tạo Tòa nhà đầu tiên (Chuẩn 34 Tỉnh/Thành)
        </h2>
        <p class="mt-1 text-sm text-white/80">
          Không gian dữ liệu của bạn mặc định trống 100%, cô lập tuyệt đối với mọi tài khoản khác.
        </p>
      </div>

      <form class="space-y-4 p-6 sm:p-8" @submit.prevent="handleSubmit">
        <div
          v-if="errorMsg"
          class="rounded-xs border border-primary/40 bg-primary-tint px-4 py-3 text-sm text-primary"
          role="alert"
        >
          {{ errorMsg }}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label for="ob-name" class="mb-1 block text-xs font-semibold text-ink">
              Tên tòa nhà <span class="text-primary">*</span>
            </label>
            <input id="ob-name" v-model="form.name" type="text" required placeholder="VD: canho.com Signature" class="input-canho" />
          </div>

          <div>
            <label for="ob-province" class="mb-1 block text-xs font-semibold text-ink">
              Tỉnh / Thành phố (34 đơn vị) <span class="text-primary">*</span>
            </label>
            <select id="ob-province" v-model="form.province_code" required class="input-canho" @change="onProvinceChange">
              <option value="" disabled>-- Chọn Tỉnh/Thành --</option>
              <option v-for="d in divisions" :key="d.admin_code" :value="d.admin_code">{{ d.name }}</option>
            </select>
          </div>

          <div>
            <label for="ob-ward" class="mb-1 block text-xs font-semibold text-ink">
              Phường / Xã ({{ availableWards.length }} đơn vị) <span class="text-primary">*</span>
            </label>
            <select id="ob-ward" v-model="form.ward_code" required class="input-canho">
              <option value="" disabled>-- Chọn Phường/Xã --</option>
              <option v-for="w in availableWards" :key="w.ward_code" :value="w.ward_code">{{ w.name }}</option>
            </select>
          </div>

          <div class="sm:col-span-2">
            <label for="ob-address" class="mb-1 block text-xs font-semibold text-ink">Địa chỉ chi tiết</label>
            <input id="ob-address" v-model="form.address" type="text" required class="input-canho" />
          </div>

          <div>
            <label for="ob-floors" class="mb-1 block text-xs font-semibold text-ink">Số tầng</label>
            <input id="ob-floors" v-model.number="form.totalFloors" type="number" min="1" required class="input-canho tabular-nums" />
          </div>

          <div>
            <label for="ob-comm" class="mb-1 block text-xs font-semibold text-ink">Tỷ lệ hoa hồng Manager (%)</label>
            <input id="ob-comm" v-model.number="form.commissionRate" type="number" min="0" max="100" step="0.5" class="input-canho tabular-nums" />
          </div>

          <div>
            <label for="ob-elec" class="mb-1 block text-xs font-semibold text-ink">Đơn giá điện (VNĐ/kWh)</label>
            <input id="ob-elec" v-model.number="form.electricityPrice" type="number" min="0" step="100" class="input-canho tabular-nums" />
          </div>

          <div>
            <label for="ob-water" class="mb-1 block text-xs font-semibold text-ink">Đơn giá nước (VNĐ/m³)</label>
            <input id="ob-water" v-model.number="form.waterPrice" type="number" min="0" step="500" class="input-canho tabular-nums" />
          </div>
        </div>

        <div class="flex justify-end border-t border-hairline pt-4">
          <button type="submit" class="btn-primary-pill px-6 py-2.5" :disabled="submitting">
            <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" />
            <Building2 v-else class="h-4 w-4" />
            <span>{{ submitting ? 'Đang khởi tạo...' : 'Khởi tạo Tòa nhà ngay' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Sparkles, Building2, Loader2 } from 'lucide-vue-next';
import { getErrorMessage } from '@/api/axios';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToastStore } from '@/stores/toast';

const workspaceStore = useWorkspaceStore();
const toastStore = useToastStore();

const divisions = ref([]);
const submitting = ref(false);
const errorMsg = ref('');

const form = reactive({
  name: '',
  province_code: '',
  ward_code: '',
  address: '',
  totalFloors: 5,
  electricityPrice: 3500,
  waterPrice: 20000,
  commissionRate: 5,
});

const availableWards = computed(() => {
  const div = divisions.value.find((d) => d.admin_code === form.province_code);
  return div ? div.wards || [] : [];
});

function onProvinceChange() {
  form.ward_code = availableWards.value[0]?.ward_code || '';
}

onMounted(async () => {
  try {
    divisions.value = await workspaceStore.fetchDivisions();
    if (divisions.value.length > 0) {
      const hcm = divisions.value.find((d) => d.admin_code === '79') || divisions.value[0];
      form.province_code = hcm.admin_code;
      form.ward_code = hcm.wards?.[0]?.ward_code || '';
    }
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  }
});

async function handleSubmit() {
  submitting.value = true;
  errorMsg.value = '';
  try {
    const created = await workspaceStore.createBuilding({
      name: form.name,
      address: form.address,
      province_code: form.province_code,
      ward_code: form.ward_code,
      totalFloors: form.totalFloors,
      pricingConfig: {
        electricityPrice: form.electricityPrice,
        waterPrice: form.waterPrice,
      },
      commissionConfig: {
        defaultCommissionRate: form.commissionRate,
      },
    });
    toastStore.success(`Đã khởi tạo "${created.name}" thành công!`);
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>
