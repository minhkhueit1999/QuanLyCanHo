export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = import.meta.env.VITE_API_BASE_URL || '';
  if (base.startsWith('http')) {
    try {
      const origin = new URL(base).origin;
      return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    } catch {
      return url;
    }
  }
  return url;
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function toDateInput(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function getTodayInput() {
  return toDateInput(new Date());
}

export function addMonthsInput(months = 12) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return toDateInput(d);
}

export const ROOM_STATUS_META = {
  available: {
    label: 'Trống',
    badgeClass: 'bg-status-available-tint text-status-available border border-status-available/30',
    borderTopClass: 'border-t-status-available',
  },
  occupied: {
    label: 'Đang thuê',
    badgeClass: 'bg-status-occupied-tint text-status-occupied border border-status-occupied/30',
    borderTopClass: 'border-t-status-occupied',
  },
  reserved: {
    label: 'Giữ chỗ',
    badgeClass: 'bg-status-reserved-tint text-status-reserved border border-status-reserved/30',
    borderTopClass: 'border-t-status-reserved',
  },
  maintenance: {
    label: 'Bảo trì',
    badgeClass: 'bg-status-reserved-tint text-status-reserved border border-status-reserved/30',
    borderTopClass: 'border-t-status-reserved',
  },
  pending_approval: {
    label: 'Chờ duyệt',
    badgeClass: 'bg-gold-tint text-wood border border-gold/40',
    borderTopClass: 'border-t-gold',
  },
  draft: {
    label: 'Nháp',
    badgeClass: 'bg-surface-alt text-muted border border-hairline',
    borderTopClass: 'border-t-neutral-1',
  },
};

export const INVOICE_STATUS_META = {
  paid: {
    label: 'Đã thu',
    badgeClass: 'bg-status-available-tint text-status-available border border-status-available/30',
  },
  partial: {
    label: 'Thu một phần',
    badgeClass: 'bg-status-reserved-tint text-status-reserved border border-status-reserved/30',
  },
  unpaid: {
    label: 'Chưa thu',
    badgeClass: 'bg-status-occupied-tint text-status-occupied border border-status-occupied/30',
  },
  overdue: {
    label: 'Quá hạn',
    badgeClass: 'bg-primary text-white border border-primary',
  },
  cancelled: {
    label: 'Đã hủy',
    badgeClass: 'bg-surface-alt text-muted border border-hairline',
  },
  draft: {
    label: 'Chưa chốt',
    badgeClass: 'bg-surface-alt text-muted border border-hairline',
  },
};

export const SUBROLE_LABELS = {
  super_admin: 'Quản trị tối cao',
  operations: 'Vận hành',
  accountant: 'Kế toán',
  customer_care: 'CSKH',
};

export const USER_LIFECYCLE_LABELS = {
  guest: 'Khách vãng lai',
  depositor: 'Người đặt cọc',
  resident: 'Cư dân chính thức',
  former: 'Cư dân cũ',
};
