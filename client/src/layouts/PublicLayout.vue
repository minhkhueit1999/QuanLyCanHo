<template>
  <div class="flex min-h-screen flex-col bg-canvas text-ink">
    <!-- Deep-Wood Booking-Inspired Header -->
    <header class="no-print wood-lattice-bg border-b border-gold/40 text-white">
      <div class="container-canho flex flex-wrap items-center justify-between gap-4 py-4">
        <router-link to="/explore" class="flex items-center gap-3">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-gold bg-primary text-white shadow-canho"
          >
            <span class="font-serif text-lg font-bold">居</span>
          </div>
          <div>
            <span class="block font-serif text-xl font-bold leading-tight tracking-normal text-white">
              canho.com
            </span>
            <span class="block text-[11px] font-medium text-gold">
              Đẳng cấp tạo nên thương hiệu
            </span>
          </div>
        </router-link>

        <nav class="flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Điều hướng cổng khách thuê">
          <router-link
            to="/explore"
            class="rounded-full px-4 py-2 text-xs font-medium transition sm:text-sm"
            :class="
              route.path === '/explore'
                ? 'bg-primary text-white'
                : 'text-white/85 hover:bg-wood hover:text-gold'
            "
          >
            Khám phá phòng trống
          </router-link>

          <router-link
            v-if="authStore.isAuthenticated"
            to="/portal"
            class="rounded-full px-4 py-2 text-xs font-medium transition sm:text-sm"
            :class="
              route.path === '/portal'
                ? 'bg-primary text-white'
                : 'text-white/85 hover:bg-wood hover:text-gold'
            "
          >
            Cổng Cư dân &amp; Đặt cọc
          </router-link>

          <router-link
            v-if="authStore.isStaff"
            to="/workspace/dashboard"
            class="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/15 px-4 py-2 text-xs font-semibold text-gold transition hover:bg-gold hover:text-ink sm:text-sm"
          >
            <Building2 class="h-4 w-4" aria-hidden="true" />
            <span>Quản trị Tòa nhà</span>
          </router-link>

          <template v-if="!authStore.isAuthenticated">
            <router-link
              to="/login"
              class="rounded-full border border-white/25 px-4 py-2 text-xs font-medium text-white transition hover:border-gold hover:text-gold sm:text-sm"
            >
              Đăng nhập
            </router-link>
            <router-link
              to="/register"
              class="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover sm:text-sm"
            >
              Đăng ký ngay
            </router-link>
          </template>

          <template v-else>
            <div class="hidden items-center gap-2 rounded-full border border-gold/30 bg-wood px-3 py-1.5 text-xs sm:flex">
              <span class="font-semibold text-white">{{ authStore.user?.fullName }}</span>
              <span class="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                {{ badgeText }}
              </span>
            </div>
            <button
              type="button"
              class="rounded-full border border-white/25 px-3 py-1.5 text-xs font-medium text-white/90 hover:border-primary hover:bg-primary cursor-pointer"
              @click="handleLogout"
            >
              Đăng xuất
            </button>
          </template>
        </nav>
      </div>
    </header>

    <!-- Main View -->
    <main class="flex-1">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="no-print border-t border-hairline bg-wood-deep py-8 text-white/80">
      <div class="container-canho flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p class="font-serif text-lg font-bold text-white">canho.com</p>
          <p class="text-xs text-gold">Đẳng cấp tạo nên thương hiệu</p>
          <p class="mt-1 text-xs text-white/60">
            Nền tảng tìm kiếm, đặt cọc giữ chỗ &amp; vận hành căn hộ đa tòa nhà chuẩn 34 Tỉnh/Thành.
          </p>
        </div>
        <div class="text-xs text-white/60">
          © 2026 canho.com • Modern Neo-Chinese Luxury Architecture
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Building2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { USER_LIFECYCLE_LABELS } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toastStore = useToastStore();

const badgeText = computed(() => {
  if (authStore.isAdmin) return 'ADMIN';
  if (authStore.isManager) return 'MANAGER';
  return USER_LIFECYCLE_LABELS[authStore.user?.userStatus] || 'KHÁCH';
});

function handleLogout() {
  authStore.logout();
  toastStore.success('Đã đăng xuất khỏi canho.com');
  router.push('/login');
}
</script>
