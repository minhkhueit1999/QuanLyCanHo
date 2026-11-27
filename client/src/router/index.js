import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import PublicLayout from '@/layouts/PublicLayout.vue';
import MainLayout from '@/layouts/MainLayout.vue';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true, title: 'Đăng nhập • canho.com' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { guestOnly: true, title: 'Đăng ký Người dùng • canho.com' },
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/views/VerifyEmailView.vue'),
    meta: { title: 'Xác nhận Email • canho.com' },
  },
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', redirect: '/explore' },
      {
        path: 'explore',
        name: 'explore',
        component: () => import('@/views/ExploreView.vue'),
        meta: { title: 'Khám phá phòng trống • canho.com' },
      },
      {
        path: 'portal',
        name: 'portal',
        component: () => import('@/views/ResidentPortalView.vue'),
        meta: { requiresAuth: true, title: 'Cổng Khách thuê & Cư dân • canho.com' },
      },
    ],
  },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true, requiresStaff: true },
    children: [
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/ReportsView.vue'),
        meta: { title: 'Báo cáo & Tổng quan vận hành' },
      },
      {
        path: 'rooms',
        name: 'rooms',
        component: () => import('@/views/RoomsView.vue'),
        meta: { title: 'Sơ đồ Tòa nhà & Quản lý Phòng' },
      },
      {
        path: 'deposits',
        name: 'deposits',
        component: () => import('@/views/DepositsView.vue'),
        meta: { title: 'Đặt cọc giữ chỗ & Lịch xem phòng' },
      },
      {
        path: 'contracts',
        name: 'contracts',
        component: () => import('@/views/ContractsView.vue'),
        meta: { title: 'Hợp đồng & Biên bản bàn giao' },
      },
      {
        path: 'invoices',
        name: 'invoices',
        component: () => import('@/views/InvoicesView.vue'),
        meta: { title: 'Chốt Điện Nước & Hóa đơn' },
      },
      {
        path: 'services',
        name: 'services',
        component: () => import('@/views/ServicesView.vue'),
        meta: { title: 'Dịch vụ & Bảo trì / Sự cố' },
      },
      {
        path: 'violations',
        name: 'violations',
        component: () => import('@/views/ViolationsView.vue'),
        meta: { title: 'Vi phạm nội quy' },
      },
      {
        path: 'commissions',
        name: 'commissions',
        component: () => import('@/views/CommissionsView.vue'),
        meta: { title: 'Hoa hồng Manager & Đối soát tiền mặt' },
      },
      {
        path: 'admin/governance',
        name: 'admin-governance',
        component: () => import('@/views/AdminGovernanceView.vue'),
        meta: { requiresAdmin: true, title: 'Quản trị Tòa nhà, Nhân sự & Audit Log' },
      },
      // Compatibility redirects
      { path: 'workspace/dashboard', redirect: '/reports' },
      { path: 'workspace/rooms', redirect: '/rooms' },
      { path: 'workspace/leasing', redirect: '/contracts' },
      { path: 'workspace/invoices', redirect: '/invoices' },
      { path: 'workspace/services', redirect: '/services' },
      { path: 'workspace/commissions', redirect: '/commissions' },
      { path: 'workspace/admin', redirect: '/admin/governance' },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/explore',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const toastStore = useToastStore();

  if (authStore.token && !authStore.initialized) {
    try {
      await authStore.fetchMe();
    } catch {
      return { name: 'login' };
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return authStore.isStaff ? { name: 'reports' } : { name: 'explore' };
  }

  if (to.meta.requiresStaff && !authStore.isStaff) {
    toastStore.warning('Khu vực quản trị chỉ dành cho Admin và Manager');
    return { name: 'portal' };
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    toastStore.warning('Chỉ Admin mới được truy cập Quản trị Tòa nhà, Nhân sự & Audit Log');
    return { name: 'reports' };
  }

  return true;
});

export default router;
