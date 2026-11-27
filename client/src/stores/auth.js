import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/axios';
import { useWorkspaceStore } from './workspace';

const TOKEN_KEY = 'canho_token';
const USER_KEY = 'canho_user';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '');
  const savedUser = localStorage.getItem(USER_KEY);
  const user = ref(savedUser ? JSON.parse(savedUser) : null);
  const initialized = ref(false);

  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isManager = computed(() => user.value?.role === 'manager');
  const isUser = computed(() => user.value?.role === 'user');
  const isStaff = computed(() => ['admin', 'manager'].includes(user.value?.role));

  function setSession(newToken, newUser, buildingsList = []) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));

    const workspaceStore = useWorkspaceStore();
    if (Array.isArray(buildingsList) && ['admin', 'manager'].includes(newUser?.role)) {
      workspaceStore.setBuildings(buildingsList);
      workspaceStore.fetchManagerCashStatus();
    } else {
      workspaceStore.clearWorkspace();
    }
    initialized.value = true;
  }

  async function login(credentials) {
    useWorkspaceStore().clearWorkspace();
    const res = await api.post('/auth/login', credentials);
    const { token: t, user: u, buildings } = res.data.data;
    setSession(t, u, buildings);
    return res.data;
  }

  /**
   * Public registration only creates role:'user' without OTP or email verification.
   */
  async function register(payload) {
    useWorkspaceStore().clearWorkspace();
    const res = await api.post('/auth/register', {
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
    });
    const { token: t, user: u, buildings } = res.data.data;
    setSession(t, u, buildings);
    return res.data;
  }

  async function fetchMe() {
    if (!token.value) {
      initialized.value = true;
      return null;
    }
    try {
      const res = await api.get('/auth/me');
      const { user: freshUser, buildings } = res.data.data;
      user.value = freshUser;
      localStorage.setItem(USER_KEY, JSON.stringify(freshUser));

      const workspaceStore = useWorkspaceStore();
      if (['admin', 'manager'].includes(freshUser?.role)) {
        workspaceStore.setBuildings(buildings || []);
        workspaceStore.fetchManagerCashStatus();
      } else {
        workspaceStore.clearWorkspace();
      }
      initialized.value = true;
      return freshUser;
    } catch (err) {
      logout();
      throw err;
    }
  }

  function logout() {
    token.value = '';
    user.value = null;
    initialized.value = true;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    useWorkspaceStore().clearWorkspace();
  }

  return {
    token,
    user,
    initialized,
    isAuthenticated,
    isAdmin,
    isManager,
    isUser,
    isStaff,
    login,
    register,
    fetchMe,
    logout,
  };
});
