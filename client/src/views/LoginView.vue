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

      <div class="max-w-lg space-y-5">
        <span class="inline-block rounded-full border border-gold/40 bg-gold/15 px-3.5 py-1 text-xs font-medium text-gold">
          Modern Neo-Chinese Luxury • 34 Tỉnh/Thành
        </span>
        <h1 class="font-serif text-4xl font-bold leading-tight text-white">
          Đẳng cấp quản trị, <br />
          <span class="text-gold">trọn vẹn từng không gian sống.</span>
        </h1>
        <p class="text-sm leading-relaxed text-white/80">
          Nền tảng hợp nhất tìm kiếm căn hộ, đặt cọc giữ chỗ 15p/24h, hợp đồng bàn giao điện tử, chốt điện nước minh bạch và đối soát hoa hồng theo từng tòa nhà.
        </p>
      </div>

      <p class="text-xs text-white/55">© 2026 canho.com • Đẳng cấp tạo nên thương hiệu</p>
    </div>

    <!-- Right Auth Panel -->
    <div class="flex flex-1 items-center justify-center px-6 py-12">
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

        <div class="card-gold neo-lattice p-7 sm:p-8">
          <div class="mb-5">
            <h2 class="font-serif text-2xl font-bold text-ink">Đăng nhập canho.com</h2>
            <p class="mt-1 text-xs text-muted">
              Sử dụng Email và Mật khẩu để truy cập hệ thống
            </p>
          </div>

          <div
            v-if="errorMsg"
            class="mb-4 rounded-xs border border-primary/40 bg-primary-tint px-4 py-3 text-xs font-medium text-primary"
            role="alert"
          >
            {{ errorMsg }}
          </div>

          <form class="space-y-4" @submit.prevent="handlePasswordLogin">
            <div>
              <label for="login-email" class="mb-1 block text-xs font-semibold text-ink">Email</label>
              <input
                id="login-email"
                v-model="form.email"
                type="email"
                required
                autocomplete="email"
                class="input-canho min-h-[44px]"
                placeholder="email@canho.com"
              />
            </div>

            <div>
              <label for="login-password" class="mb-1 block text-xs font-semibold text-ink">Mật khẩu</label>
              <div class="relative">
                <input
                  id="login-password"
                  v-model="form.password"
                  :type="showPass ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  class="input-canho min-h-[44px] pr-11"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink cursor-pointer"
                  aria-label="Hiện/ẩn mật khẩu"
                  @click="showPass = !showPass"
                >
                  <EyeOff v-if="showPass" class="h-4 w-4" />
                  <Eye v-else class="h-4 w-4" />
                </button>
              </div>
            </div>

            <button type="submit" class="btn-primary-pill min-h-[44px] w-full py-2.5" :disabled="submitting">
              <Loader2 v-if="submitting" class="h-4 w-4 animate-spin" />
              <LogIn v-else class="h-4 w-4" />
              <span>{{ submitting ? 'Đang đăng nhập...' : 'Đăng nhập' }}</span>
            </button>
          </form>

          <p class="mt-4 rounded-xs border border-hairline bg-canvas/70 px-3 py-2 text-[11px] leading-relaxed text-muted">
            Khách thuê có thể đăng ký trực tuyến. Tài khoản Quản lý (Manager) được Quản trị viên cấp phát nội bộ.
          </p>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-xs text-muted">
            <router-link to="/register" class="font-semibold text-primary hover:underline">
              Đăng ký Khách thuê mới →
            </router-link>
            <router-link to="/explore" class="hover:text-ink hover:underline">
              Xem sàn phòng trống
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { getErrorMessage } from '@/api/axios';

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const showPass = ref(false);
const submitting = ref(false);
const errorMsg = ref('');

const form = reactive({ email: '', password: '' });

function redirectAfterAuth() {
  toastStore.success(`Chào mừng ${authStore.user.fullName} đến với canho.com`);
  router.push(authStore.isStaff ? '/reports' : '/explore');
}

async function handlePasswordLogin() {
  submitting.value = true;
  errorMsg.value = '';
  try {
    await authStore.login({ ...form });
    redirectAfterAuth();
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>
