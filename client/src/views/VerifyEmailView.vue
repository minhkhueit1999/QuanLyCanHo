<template>
  <div class="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
    <div class="w-full max-w-md space-y-6">
      <router-link to="/explore" class="flex items-center justify-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-xs border border-gold bg-primary text-white shadow-canho">
          <span class="font-serif text-lg font-bold">居</span>
        </div>
        <div>
          <span class="block font-serif text-2xl font-bold text-ink">canho.com</span>
          <span class="block text-xs font-medium text-gold">Đẳng cấp tạo nên thương hiệu</span>
        </div>
      </router-link>

      <div class="card-gold neo-lattice p-7 text-center sm:p-8">
        <!-- State: Verifying -->
        <div v-if="status === 'verifying'" class="space-y-4 py-4">
          <Loader2 class="mx-auto h-10 w-10 animate-spin text-primary" />
          <h1 class="font-serif text-2xl font-bold text-ink">Đang xác nhận Email</h1>
          <p class="text-xs text-muted">
            Hệ thống canho.com đang kiểm tra liên kết kích hoạt của bạn...
          </p>
        </div>

        <!-- State: Success -->
        <div v-else-if="status === 'success'" class="space-y-4">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-status-available/30 bg-status-available-tint text-status-available">
            <CheckCircle2 class="h-6 w-6" />
          </div>
          <h1 class="font-serif text-2xl font-bold text-ink">Kích hoạt tài khoản thành công</h1>
          <p class="text-xs leading-relaxed text-muted">
            Chào mừng <strong class="text-ink">{{ authStore.user?.fullName }}</strong>! Email của bạn đã được xác nhận và phiên đăng nhập đã sẵn sàng.
          </p>
          <div class="flex flex-col gap-2.5 pt-2">
            <router-link to="/explore" class="btn-primary-pill min-h-[44px] w-full py-2.5">
              Khám phá căn hộ ngay
            </router-link>
            <router-link to="/portal" class="btn-secondary-pill min-h-[44px] w-full py-2.5">
              Mở Cổng Khách thuê
            </router-link>
          </div>
        </div>

        <!-- State: Error / Missing / Expired Token -->
        <div v-else class="space-y-4 text-left">
          <div class="text-center">
            <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary-tint text-primary">
              <AlertTriangle class="h-6 w-6" />
            </div>
            <h1 class="font-serif text-2xl font-bold text-ink">Không thể xác nhận liên kết</h1>
            <p class="mt-1 text-xs text-primary">{{ errorMsg }}</p>
          </div>

          <form class="space-y-3 border-t border-hairline pt-4" @submit.prevent="submitManualToken">
            <label for="verify-token-input" class="block text-xs font-semibold text-ink">
              Nhập hoặc dán mã Token xác nhận (nếu mở thủ công)
            </label>
            <input
              id="verify-token-input"
              v-model="manualToken"
              type="text"
              placeholder="Dán chuỗi token xác nhận tại đây..."
              class="input-canho min-h-[44px]"
            />
            <button type="submit" class="btn-primary-pill min-h-[44px] w-full py-2 text-xs" :disabled="!manualToken.trim()">
              Xác thực ngay
            </button>
          </form>

          <form class="space-y-3 border-t border-hairline pt-4" @submit.prevent="handleResend">
            <label for="resend-email-input" class="block text-xs font-semibold text-ink">
              Hoặc gửi lại liên kết kích hoạt mới về Email
            </label>
            <input
              id="resend-email-input"
              v-model="resendEmail"
              type="email"
              required
              placeholder="email@canho.com"
              class="input-canho min-h-[44px]"
            />
            <button
              type="submit"
              class="btn-gold-pill min-h-[44px] w-full py-2 text-xs"
              :disabled="resending || cooldown > 0"
            >
              <Loader2 v-if="resending" class="h-3.5 w-3.5 animate-spin" />
              <MailCheck v-else class="h-3.5 w-3.5" />
              <span v-if="cooldown > 0" class="tabular-nums">
                Gửi lại sau {{ cooldown }}s
              </span>
              <span v-else>Gửi lại link kích hoạt</span>
            </button>

            <div
              v-if="devVerifyPath"
              class="rounded-xs border border-gold bg-gold-tint px-3 py-2 text-[11px] text-ink"
            >
              <span class="font-semibold">Link phát triển mới:</span>
              <button type="button" class="ml-1 font-bold text-primary underline cursor-pointer" @click="verifyFromDevPath">
                Kích hoạt ngay →
              </button>
            </div>
          </form>

          <div class="pt-2 text-center text-xs text-muted">
            <router-link to="/login" class="font-semibold text-primary hover:underline">
              ← Quay lại Đăng nhập
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loader2, CheckCircle2, AlertTriangle, MailCheck } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { getErrorMessage } from '@/api/axios';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const status = ref('verifying'); // verifying | success | error
const errorMsg = ref('');
const manualToken = ref('');
const resendEmail = ref('');
const resending = ref(false);
const cooldown = ref(0);
const devVerifyPath = ref('');
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

async function runVerify(rawToken) {
  if (!rawToken) {
    status.value = 'error';
    errorMsg.value = 'Thiếu mã token xác nhận trên liên kết.';
    return;
  }
  status.value = 'verifying';
  errorMsg.value = '';
  try {
    await authStore.verifyEmail(rawToken);
    status.value = 'success';
    toastStore.success('Kích hoạt email thành công!');
  } catch (err) {
    status.value = 'error';
    errorMsg.value = getErrorMessage(err);
  }
}

async function submitManualToken() {
  if (!manualToken.value.trim()) return;
  await runVerify(manualToken.value.trim());
}

async function handleResend() {
  if (!resendEmail.value.trim()) return;
  resending.value = true;
  devVerifyPath.value = '';
  try {
    const res = await authStore.resendVerification(resendEmail.value.trim());
    startCooldown(res.data?.cooldownSeconds ?? 60);
    if (res.data?.devVerificationUrl) {
      try {
        const parsed = new URL(res.data.devVerificationUrl);
        devVerifyPath.value = `${parsed.pathname}${parsed.search}`;
      } catch {
        devVerifyPath.value = '';
      }
    }
    toastStore.success(res.message || 'Đã gửi lại liên kết kích hoạt');
  } catch (err) {
    const retryAfter = err?.response?.data?.retryAfterSeconds;
    if (retryAfter) startCooldown(retryAfter);
    toastStore.error(getErrorMessage(err));
  } finally {
    resending.value = false;
  }
}

async function verifyFromDevPath() {
  if (!devVerifyPath.value) return;
  await router.push(devVerifyPath.value);
  const nextToken = String(new URLSearchParams(devVerifyPath.value.split('?')[1] || '').get('token') || '');
  if (nextToken) {
    await runVerify(nextToken);
  }
}

onMounted(() => {
  const tokenParam = String(route.query.token || '').trim();
  if (tokenParam) {
    runVerify(tokenParam);
  } else {
    status.value = 'error';
    errorMsg.value = 'Liên kết không chứa mã xác nhận hợp lệ.';
  }
});

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>
