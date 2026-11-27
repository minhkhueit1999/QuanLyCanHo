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
          Tài khoản Khách thuê • Xác thực Email bảo mật
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

        <!-- Post-Registration Email Verification State -->
        <div v-if="verificationSent" class="card-gold neo-lattice space-y-5 p-7 sm:p-8">
          <div class="flex items-start gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-status-available/30 bg-status-available-tint text-status-available">
              <MailCheck class="h-5 w-5" />
            </div>
            <div>
              <h2 class="font-serif text-2xl font-bold text-ink">Kiểm tra hộp thư của bạn</h2>
              <p class="mt-1 text-xs text-muted">
                Chúng tôi đã gửi liên kết kích hoạt tài khoản Người dùng đến:
              </p>
              <p class="mt-1 text-sm font-semibold text-primary">{{ registeredEmail }}</p>
            </div>
          </div>

          <div class="rounded-xs border border-hairline bg-canvas p-4 text-xs leading-relaxed text-ink space-y-2">
            <p>• Mở email và nhấn vào <strong>liên kết kích hoạt</strong> trong vòng <strong>30 phút</strong> để hoàn tất đăng ký.</p>
            <p>• Tài khoản mặc định thuộc vai trò <strong>Khách thuê (User)</strong>. Kiểm tra thêm mục Spam / Quảng cáo nếu chưa thấy thư.</p>
          </div>

          <!-- Development Preview Link when SMTP is not active -->
          <div
            v-if="devVerifyPath"
            class="rounded-xs border border-gold bg-gold-tint p-4 text-xs text-ink space-y-2"
          >
            <p class="font-semibold">Liên kết kích hoạt (Chế độ phát triển Local):</p>
            <router-link :to="devVerifyPath" class="btn-primary-pill min-h-[44px] w-full py-2 text-xs">
              <ExternalLink class="h-3.5 w-3.5" />
              <span>Kích hoạt tài khoản ngay</span>
            </router-link>
          </div>

          <div class="space-y-2.5 pt-1">
            <button
              type="button"
              class="btn-gold-pill min-h-[44px] w-full py-2.5 text-xs"
              :disabled="resending || cooldown > 0"
              @click="handleResend"
            >
              <Loader2 v-if="resending" class="h-4 w-4 animate-spin" />
              <RefreshCw v-else class="h-4 w-4" />
              <span v-if="cooldown > 0" class="tabular-nums">
                Gửi lại link kích hoạt sau {{ cooldown }}s
              </span>
              <span v-else>Gửi lại link kích hoạt</span>
            </button>

            <router-link to="/login" class="btn-secondary-pill min-h-[44px] w-full py-2.5 text-xs">
              Quay lại trang Đăng nhập
            </router-link>
          </div>
        </div>

        <!-- User-Only Registration Form -->
        <div v-else class="card-gold neo-lattice p-7 sm:p-8">
          <div class="mb-4">
            <span class="seal-badge mb-2">KHÁCH THUÊ CANHO.COM</span>
            <h2 class="font-serif text-2xl font-bold text-ink">Đăng ký tài khoản Người dùng</h2>
            <p class="mt-1 text-xs text-muted">
              Xác nhận qua liên kết gửi về Email cá nhân • Không sử dụng mã OTP
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
                <label for="reg-email" class="mb-1 block text-xs font-semibold text-ink">Email xác thực</label>
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
              <span>{{ submitting ? 'Đang khởi tạo...' : 'Đăng ký Khách thuê & Gửi Email xác thực' }}</span>
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
import { onBeforeUnmount, reactive, ref } from 'vue';
import { UserPlus, Loader2, MailCheck, RefreshCw, ExternalLink } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { getErrorMessage } from '@/api/axios';

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
const resending = ref(false);
const errorMsg = ref('');
const verificationSent = ref(false);
const registeredEmail = ref('');
const devVerifyPath = ref('');
const cooldown = ref(0);
let cooldownTimer = null;

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

async function handleRegister() {
  errorMsg.value = '';
  if (form.password !== form.confirmPassword) {
    errorMsg.value = 'Mật khẩu xác nhận không khớp';
    return;
  }
  submitting.value = true;
  try {
    const res = await authStore.register({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      password: form.password,
    });
    registeredEmail.value = res.data?.user?.email || form.email;
    devVerifyPath.value = extractRelativeVerifyPath(res.data?.devVerificationUrl);
    verificationSent.value = true;
    startCooldown(res.data?.cooldownSeconds ?? 60);
    toastStore.success('Đã tạo tài khoản! Vui lòng kiểm tra email để kích hoạt.');
  } catch (err) {
    errorMsg.value = getErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}

async function handleResend() {
  if (!registeredEmail.value) return;
  resending.value = true;
  try {
    const res = await authStore.resendVerification(registeredEmail.value);
    devVerifyPath.value = extractRelativeVerifyPath(res.data?.devVerificationUrl);
    startCooldown(res.data?.cooldownSeconds ?? 60);
    toastStore.success(res.message || 'Đã gửi lại liên kết kích hoạt');
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
