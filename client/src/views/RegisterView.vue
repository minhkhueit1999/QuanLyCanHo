<template>
  <div class="flex min-h-screen bg-canvas">
    <!-- Left Neo-Chinese Luxury Wood Panel -->
    <div class="wood-lattice-bg relative hidden w-1/2 flex-col justify-between p-12 text-white lg:flex">
      <router-link to="/explore" class="flex items-center gap-3.5">
        <div class="flex h-12 w-12 items-center justify-center rounded-xs border border-gold bg-primary text-white shadow-canho">
          <span class="font-serif text-xl font-bold">居</span>
        </div>
        <div>
          <span class="block font-serif text-2xl font-bold text-white">canho.com</span>
          <span class="block text-xs font-medium text-gold">Đẳng cấp tạo nên thương hiệu</span>
        </div>
      </router-link>

      <div class="max-w-lg space-y-4">
        <span class="inline-block rounded-full border border-gold/40 bg-gold/15 px-3.5 py-1 text-xs font-medium text-gold">
          Tài khoản Khách thuê • Kích hoạt tức thì
        </span>
        <h1 class="font-serif text-4xl font-bold leading-tight text-white">
          Tìm căn hộ xứng tầm, <br />
          <span class="text-gold">đặt cọc minh bạch tức thì.</span>
        </h1>
        <p class="text-sm leading-relaxed text-white/80">
          Đăng ký tài khoản Người dùng (Khách thuê) trên canho.com để lưu lịch hẹn xem phòng, đặt cọc giữ chỗ 15p/24h, ký hợp đồng điện tử và theo dõi hóa đơn điện nước hàng tháng.
        </p>
      </div>

      <p class="text-xs text-white/55">© 2026 canho.com • Đẳng cấp tạo nên thương hiệu</p>
    </div>

    <!-- Right Registration Panel -->
    <div class="flex flex-1 items-center justify-center px-6 py-10">
      <div class="w-full max-w-md">
        <div class="mb-6 flex items-center gap-3 lg:hidden">
          <div class="flex h-11 w-11 items-center justify-center rounded-xs border border-gold bg-primary text-white">
            <span class="font-serif text-lg font-bold">居</span>
          </div>
          <div>
            <span class="block font-serif text-xl font-bold text-ink">canho.com</span>
            <span class="block text-xs font-medium text-gold">Đẳng cấp tạo nên thương hiệu</span>
          </div>
        </div>

        <!-- User-Only Registration Form -->
        <div class="card-gold neo-lattice p-7 sm:p-8">
          <div class="mb-4">
            <span class="seal-badge mb-2">KHÁCH THUÊ CANHO.COM</span>
            <h2 class="font-serif text-2xl font-bold text-ink">Đăng ký tài khoản Người dùng</h2>
            <p class="mt-1 text-xs text-muted">
              Tạo tài khoản Khách thuê nhanh chóng • Không cần mã OTP
            </p>
          </div>

          <div
            v-if="errorMsg"
            class="mb-4 rounded-xs border border-primary/40 bg-primary-tint px-4 py-3 text-xs text-primary"
            role="alert"
          >
            {{ errorMsg }}
          </div>

          <form class="space-y-3.5" @submit.prevent="handleRegister">
            <div>
              <label for="reg-name" class="mb-1 block text-xs font-semibold text-ink">Họ và tên</label>
              <input
                id="reg-name"
                v-model="form.fullName"
                type="text"
                required
                placeholder="Nguyễn Minh Khang"
                class="input-canho min-h-[44px]"
              />
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label for="reg-email" class="mb-1 block text-xs font-semibold text-ink">Email</label>
                <input
                  id="reg-email"
                  v-model="form.email"
                  type="email"
                  required
                  placeholder="khachthue@gmail.com"
                  class="input-canho min-h-[44px]"
                />
              </div>
              <div>
                <label for="reg-phone" class="mb-1 block text-xs font-semibold text-ink">Số điện thoại</label>
                <input
                  id="reg-phone"
                  v-model="form.phone"
                  type="tel"
                  placeholder="0901234567"
                  class="input-canho min-h-[44px] tabular-nums"
                />
              </div>
            </div>

            <div>
              <label for="reg-pass" class="mb-1 block text-xs font-semibold text-ink">Mật khẩu (tối thiểu 6 ký tự)</label>
              <input
                id="reg-pass"
                v-model="form.password"
                type="password"
                minlength="6"
                required
                class="input-canho min-h-[44px]"
              />
            </div>

            <div>
              <label for="reg-pass2" class="mb-1 block text-xs font-semibold text-ink">Xác nhận mật khẩu</label>
              <input
                id="reg-pass2"
                v-model="form.confirmPassword"
                type="password"
                minlength="6"
                required
                class="input-canho min-h-[44px]"
              />
            </div>

            <button type="submit" class="btn-primary-pill min-h-[44px] w-full py-2.5" :disabled="submitting">
              <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" />
              <UserPlus v-else class="h-4 w-4" />
              <span>{{ submitting ? 'Đang khởi tạo...' : 'Đăng ký Khách thuê canho.com' }}</span>
            </button>
          </form>

          <p class="mt-4 rounded-xs border border-hairline bg-canvas/70 px-3 py-2 text-[11px] leading-relaxed text-muted">
            Lưu ý: Cổng đăng ký công khai chỉ mở cho tài khoản Người dùng. Tài khoản Quản lý (Manager) do Quản trị viên cấp nội bộ.
          </p>

          <p class="mt-4 border-t border-hairline pt-4 text-center text-xs text-muted">
            Đã có tài khoản?
            <router-link to="/login" class="font-semibold text-primary hover:underline">
              Đăng nhập ngay
            </router-link>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserPlus, Loader2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { getErrorMessage } from '@/api/axios';

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const form = reactive({
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
});

const submitting = ref(false);
const errorMsg = ref('');

async function handleRegister() {
  errorMsg.value = '';
  if (form.password !== form.confirmPassword) {
    errorMsg.value = 'Mật khẩu xác nhận không khớp';
    return;
  }
  submitting.value = true;
  try {
    await authStore.register({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      password: form.password,
    });
    toastStore.success(`Chào mừng ${authStore.user?.fullName || 'bạn'} đến với canho.com!`);
    router.push('/explore');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>
