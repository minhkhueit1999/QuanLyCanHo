<template>
  <div class="flex min-h-screen bg-canvas text-ink">
    <div
      v-if="mobileMenuOpen"
      class="no-print fixed inset-0 z-40 bg-wood-deep/65 backdrop-blur-sm lg:hidden"
      @click="mobileMenuOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside
      class="no-print fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-wood bg-wood-deep text-white transition-transform duration-200 lg:static lg:translate-x-0"
      :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex items-center justify-between border-b border-wood px-5 py-4">
        <router-link to="/reports" class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border border-gold bg-primary text-white">
            <span class="font-serif text-lg font-bold">居</span>
          </div>
          <div>
            <span class="block font-serif text-lg font-bold leading-tight text-white">
              canho.com
            </span>
            <span class="block text-[10px] font-medium text-gold">
              Đẳng cấp tạo nên thương hiệu
            </span>
          </div>
        </router-link>
        <button
          type="button"
          class="rounded-full p-1.5 text-white/75 hover:bg-wood lg:hidden cursor-pointer"
          aria-label="Đóng menu"
          @click="mobileMenuOpen = false"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng vận hành">
        <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Vận hành Tòa nhà
        </p>

        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-xs px-3.5 py-2 text-sm transition-colors"
          :class="
            route.path === item.to
              ? 'border-l-2 border-gold bg-wood font-semibold text-gold'
              : 'text-white/80 hover:bg-wood/60 hover:text-white'
          "
          @click="mobileMenuOpen = false"
        >
          <component
            :is="item.icon"
            class="h-4 w-4 shrink-0"
            :class="route.path === item.to ? 'text-gold' : 'text-white/60'"
            aria-hidden="true"
          />
          <span>{{ item.label }}</span>
        </router-link>

        <template v-if="authStore.isAdmin">
          <div class="my-3 border-t border-wood"></div>
          <p class="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Kiểm soát &amp; Quản trị
          </p>
          <router-link
            to="/admin/governance"
            class="flex items-center gap-3 rounded-xs px-3.5 py-2 text-sm transition-colors"
            :class="
              route.path === '/admin/governance'
                ? 'border-l-2 border-gold bg-wood font-semibold text-gold'
                : 'text-white/80 hover:bg-wood/60 hover:text-white'
            "
            @click="mobileMenuOpen = false"
          >
            <ShieldCheck
              class="h-4 w-4 shrink-0"
              :class="route.path === '/admin/governance' ? 'text-gold' : 'text-white/60'"
              aria-hidden="true"
            />
            <span>Quản trị &amp; Audit Log</span>
          </router-link>
        </template>

        <div class="my-3 border-t border-wood"></div>
        <router-link
          to="/explore"
          class="flex items-center gap-3 rounded-xs px-3.5 py-2 text-sm text-gold/90 hover:bg-wood/60"
        >
          <Compass class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sàn canho.com công khai</span>
        </router-link>
      </nav>

      <!-- Profile Footer -->
      <div class="border-t border-wood bg-wood/60 p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold bg-wood-deep text-xs font-bold text-gold">
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">{{ authStore.user?.fullName }}</p>
            <span class="mt-0.5 inline-block rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
              {{ managerRoleBadge }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-wood-deep px-3 py-2 text-xs font-medium text-white/90 transition hover:border-primary hover:bg-primary cursor-pointer"
          @click="handleLogout"
        >
          <LogOut class="h-3.5 w-3.5" aria-hidden="true" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>

    <!-- Main Workspace -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="no-print sticky top-0 z-30 border-b border-hairline bg-surface shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="rounded-full border border-hairline bg-surface p-2 text-ink hover:bg-surface-alt lg:hidden cursor-pointer"
              aria-label="Mở menu điều hướng"
              @click="mobileMenuOpen = true"
            >
              <Menu class="h-5 w-5" />
            </button>
            <div>
              <h1 class="font-serif text-lg font-bold text-ink sm:text-xl">
                {{ route.meta.title || 'canho.com' }}
              </h1>
              <p v-if="workspaceStore.currentBuilding" class="text-xs text-muted">
                Tòa nhà:
                <strong class="text-primary">{{ workspaceStore.currentBuilding.name }}</strong>
                <span class="hidden sm:inline">
                  • {{ workspaceStore.currentBuilding.ward_name }},
                  {{ workspaceStore.currentBuilding.province_name }}
                </span>
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Manager Cash Held & 24h Overdue Alert Badge -->
            <router-link
              v-if="authStore.isManager && workspaceStore.cashStatus.heldCount > 0"
              to="/commissions"
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums"
              :class="
                workspaceStore.cashStatus.overdueCount > 0
                  ? 'border-primary bg-primary-tint text-primary'
                  : 'border-status-reserved/50 bg-status-reserved-tint text-status-reserved'
              "
            >
              <Wallet class="h-3.5 w-3.5" />
              <span>
                Giữ TM: {{ formatCurrency(workspaceStore.cashStatus.totalHeld) }}
                <template v-if="workspaceStore.cashStatus.overdueCount > 0">
                  (Quá hạn 24h!)
                </template>
              </span>
            </router-link>

            <!-- Building Switcher -->
            <div
              v-if="workspaceStore.buildings.length > 0"
              class="flex items-center gap-2 rounded-full border border-gold bg-surface px-3.5 py-1.5 shadow-sm"
            >
              <Building2 class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <label for="building-switcher" class="sr-only">Chọn tòa nhà làm việc</label>
              <select
                id="building-switcher"
                :value="workspaceStore.currentBuilding?._id || ''"
                class="max-w-[180px] bg-transparent pr-1 text-xs font-semibold text-ink focus:outline-none sm:max-w-[240px] sm:text-sm cursor-pointer"
                @change="onSwitchBuilding"
              >
                <option v-for="b in workspaceStore.buildings" :key="b._id" :value="b._id">
                  {{ b.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 px-4 py-6 sm:px-6">
        <div class="mx-auto w-full max-w-[1108px]">
          <BuildingOnboarding
            v-if="
              authStore.isAdmin &&
              workspaceStore.buildings.length === 0 &&
              route.path !== '/admin/governance'
            "
          />

          <div
            v-else-if="authStore.isManager && workspaceStore.buildings.length === 0"
            class="card-canho neo-lattice mx-auto mt-8 max-w-xl p-6"
          >
            <h2 class="font-serif text-lg font-bold text-ink">Chưa có tòa nhà được phân công</h2>
            <p class="mt-2 text-sm text-muted">
              Tài khoản Manager ({{ authStore.user?.email }}) hiện chưa được Admin bàn giao tòa nhà nào.
            </p>
          </div>

          <RouterView v-else />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  BarChart3,
  Building2,
  BookmarkCheck,
  FileSignature,
  Receipt,
  Wrench,
  AlertOctagon,
  BadgePercent,
  ShieldCheck,
  Compass,
  LogOut,
  Menu,
  X,
  Wallet,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { useToastStore } from '@/stores/toast';
import { formatCurrency, SUBROLE_LABELS } from '@/utils/format';
import BuildingOnboarding from '@/components/BuildingOnboarding.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();
const toastStore = useToastStore();

const mobileMenuOpen = ref(false);

const navItems = [
  { to: '/reports', label: 'Báo cáo & Tổng quan', icon: BarChart3 },
  { to: '/rooms', label: 'Sơ đồ & Phòng', icon: Building2 },
  { to: '/deposits', label: 'Đặt cọc & Lịch xem', icon: BookmarkCheck },
  { to: '/contracts', label: 'Hợp đồng & Bàn giao', icon: FileSignature },
  { to: '/invoices', label: 'Điện nước & Hóa đơn', icon: Receipt },
  { to: '/services', label: 'Dịch vụ & Bảo trì', icon: Wrench },
  { to: '/violations', label: 'Vi phạm nội quy', icon: AlertOctagon },
  { to: '/commissions', label: 'Hoa hồng & Tiền mặt', icon: BadgePercent },
];

const initials = computed(() => {
  const n = authStore.user?.fullName || 'C';
  const parts = n.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
});

const managerRoleBadge = computed(() => {
  if (authStore.isAdmin) {
    const sub = authStore.user?.subRole || 'super_admin';
    return `Admin • ${SUBROLE_LABELS[sub] || sub}`;
  }
  const b = workspaceStore.currentBuilding;
  if (!b) return 'Manager';
  const pmId = typeof b.primaryManagerId === 'object' ? b.primaryManagerId?._id : b.primaryManagerId;
  return pmId && pmId === authStore.user?._id ? 'Manager chính' : 'Manager dự phòng';
});

function onSwitchBuilding(e) {
  workspaceStore.selectBuilding(e.target.value);
  if (workspaceStore.currentBuilding) {
    toastStore.info(`Đã chuyển sang "${workspaceStore.currentBuilding.name}"`);
  }
}

function handleLogout() {
  authStore.logout();
  toastStore.success('Đã đăng xuất');
  router.push('/login');
}
</script>
