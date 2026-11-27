import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('canho_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const buildingId = localStorage.getItem('canho_current_building_id');
    if (buildingId) {
      config.headers['X-Building-Id'] = buildingId;
    } else {
      delete config.headers['X-Building-Id'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    if (
      status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/verify-email') &&
      !url.includes('/auth/resend-verification')
    ) {
      localStorage.removeItem('canho_token');
      localStorage.removeItem('canho_user');
      localStorage.removeItem('canho_current_building_id');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Đã xảy ra lỗi, vui lòng thử lại') {
  const status = error?.response?.status;
  const serverMsg = error?.response?.data?.message;
  if (status === 403 && !serverMsg) {
    return 'Bạn không có quyền thực hiện thao tác hoặc truy cập tòa nhà này (403)';
  }
  return serverMsg || error?.message || fallback;
}

export default api;
