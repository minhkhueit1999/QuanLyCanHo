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
          Modern Neo-Chinese Luxury 
        </span>
        <h1 class="font-serif text-4xl font-bold leading-tight text-white">
          Chạm chuẩn sống sang, <br />
          <span class="text-gold">trọn vẹn từng không gian sống.</span>
        </h1>
        <p class="text-sm leading-relaxed text-white/80">
         Hệ thống căn hộ dịch vụ cao cấp giúp bạn dễ dàng tìm không gian ưng ý, đặt cọc giữ chỗ tức thì, ký hợp đồng điện tử và theo dõi hóa đơn minh bạch.
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
              Sử dụng Email đã xác thực và Mật khẩu để truy cập hệ thống
            </p>
          </div>

          <div
            v-if="errorMsg"
            class="mb-4 rounded-xs border border-primary/40 bg-primary-tint px-4 py-3 text-xs font-medium text-primary"
            role="alert"
          >
            <p>{{ errorMsg }}</p>

            <!-- Inline Activation Resend when Email is not yet verified -->
            <div v-if="needsVerification" class="mt-3 space-y-2 border-t border-primary/20 pt-2.5">
              <button
                type="button"
                class="btn-gold-pill min-h-[44px] w-full px-4 py-2 text-xs"
                :disabled="resending || cooldown > 0"
                @click="handleResendVerification"
              >
                <Loader2 v-if="resending" class="h-3.5 w-3.5 animate-spin" />
                <MailCheck v-else class="h-3.5 w-3.5" />
                <span v-if="cooldown > 0" class="tabular-nums">
                  Gửi lại link kích hoạt sau {{ cooldown }}s
                </span>
                <span v-else>Gửi lại link kích hoạt qua Email</span>
              </button>

              <div
                v-if="devVerifyPath"
                class="rounded-xs border border-gold bg-gold-tint px-3 py-2 text-[11px] text-ink"
              >
                <span class="font-semibold">Môi trường phát triển:</span>
                <router-link :to="devVerifyPath" class="ml-1 font-bold text-primary underline">
                  Mở liên kết xác thực ngay →
                </router-link>
              </div>
            </div>
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
            Khách thuê có thể đăng ký trực tuyến bằng liên kết xác nhận Email. Tài khoản Quản lý (Manager) được Quản trị viên cấp phát nội bộ.
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
import { onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Eye, EyeOff, LogIn, Loader2, MailCheck } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { getErrorMessage } from '@/api/axios';

const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const showPass = ref(false);
const submitting = ref(false);
const resending = ref(false);
const errorMsg = ref('');
const needsVerification = ref(false);
const cooldown = ref(0);
const devVerifyPath = ref('');
let cooldownTimer = null;

const form = reactive({ email: '', password: '' });

function startCooldown(seconds) {
  const sec = Math.max(0, Number(seconds) || 0);
  cooldown.value = sec;
  if (cooldownTimer) clearInterval(cooldownTimer);
  if (sec <= 0) return;
  cooldownTimer = setInterval(() => {
    if (cooldown.value <= 1) {
      cooldown.value = 0;
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    } else {
      cooldown.value -= 1;
    }
  }, 1000);
}

function extractRelativeVerifyPath(fullUrl) {
  if (!fullUrl) return '';
  try {
    const parsed = new URL(fullUrl);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fullUrl.startsWith('/') ? fullUrl : '';
  }
}

function redirectAfterAuth() {
  toastStore.success(`Chào mừng ${authStore.user.fullName} đến với canho.com`);
  router.push(authStore.isStaff ? '/reports' : '/explore');
}

async function handlePasswordLogin() {
  submitting.value = true;
  errorMsg.value = '';
  needsVerification.value = false;
  devVerifyPath.value = '';
  try {
    await authStore.login({ ...form });
    redirectAfterAuth();
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
    const code = err?.response?.data?.code;
    if (err?.response?.status === 403 && code === 'EMAIL_NOT_VERIFIED') {
      needsVerification.value = true;
    }
  } finally {
    submitting.value = false;
  }
}

async function handleResendVerification() {
  if (!form.email) {
    toastStore.warning('Vui lòng nhập email trước khi gửi lại link kích hoạt');
    return;
  }
  resending.value = true;
  try {
    const res = await authStore.resendVerification(form.email);
    toastStore.success(res.message || 'Đã gửi lại liên kết xác nhận Email');
    startCooldown(res.data?.cooldownSeconds ?? 60);
    if (res.data?.devVerificationUrl) {
      devVerifyPath.value = extractRelativeVerifyPath(res.data.devVerificationUrl);
    }
  } catch (err) {
    const retryAfter = err?.response?.data?.retryAfterSeconds;
    if (retryAfter) {
      startCooldown(retryAfter);
    }
    toastStore.error(getErrorMessage(err));
  } finally {
    resending.value = false;
  }
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>
