import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/api/axios';

const STORAGE_KEY = 'canho_current_building_id';

export const useWorkspaceStore = defineStore('workspace', () => {
  const buildings = ref([]);
  const currentBuildingId = ref(localStorage.getItem(STORAGE_KEY) || '');
  const divisions = ref([]);
  const cashStatus = ref({ totalHeld: 0, cashLimit: 50000000, heldCount: 0, overdueCount: 0 });
  const loading = ref(false);

  const currentBuilding = computed(() => {
    if (!buildings.value.length) return null;
    return buildings.value.find((b) => b._id === currentBuildingId.value) || buildings.value[0];
  });

  function selectBuilding(id) {
    const found = buildings.value.find((b) => b._id === id);
    if (found) {
      currentBuildingId.value = found._id;
      localStorage.setItem(STORAGE_KEY, found._id);
    } else if (buildings.value.length > 0) {
      currentBuildingId.value = buildings.value[0]._id;
      localStorage.setItem(STORAGE_KEY, buildings.value[0]._id);
    } else {
      currentBuildingId.value = '';
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function setBuildings(list) {
    buildings.value = Array.isArray(list) ? list : [];
    const saved = localStorage.getItem(STORAGE_KEY);
    if (buildings.value.some((b) => b._id === saved)) {
      currentBuildingId.value = saved;
    } else if (buildings.value.length > 0) {
      currentBuildingId.value = buildings.value[0]._id;
      localStorage.setItem(STORAGE_KEY, buildings.value[0]._id);
    } else {
      currentBuildingId.value = '';
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async function fetchBuildings() {
    loading.value = true;
    try {
      const res = await api.get('/buildings');
      setBuildings(res.data.data || []);
      return buildings.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDivisions(q = '') {
    const res = await api.get('/divisions', { params: q ? { q } : {} });
    divisions.value = res.data.data || [];
    return divisions.value;
  }

  async function fetchManagerCashStatus() {
    try {
      const res = await api.get('/payments/my-cash-status');
      cashStatus.value = res.data.data || cashStatus.value;
      return cashStatus.value;
    } catch {
      return cashStatus.value;
    }
  }

  async function createBuilding(payload) {
    const res = await api.post('/buildings', payload);
    const created = res.data.data;
    buildings.value = [...buildings.value, created];
    selectBuilding(created._id);
    return created;
  }

  async function updateBuilding(id, payload) {
    const res = await api.put(`/buildings/${id}`, payload);
    const updated = res.data.data;
    buildings.value = buildings.value.map((b) => (b._id === id ? updated : b));
    return updated;
  }

  async function deleteBuilding(id) {
    await api.delete(`/buildings/${id}`);
    buildings.value = buildings.value.filter((b) => b._id !== id);
    selectBuilding(currentBuildingId.value);
  }

  function clearWorkspace() {
    buildings.value = [];
    currentBuildingId.value = '';
    cashStatus.value = { totalHeld: 0, cashLimit: 50000000, heldCount: 0, overdueCount: 0 };
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    buildings,
    currentBuildingId,
    currentBuilding,
    divisions,
    cashStatus,
    loading,
    selectBuilding,
    setBuildings,
    fetchBuildings,
    fetchDivisions,
    fetchManagerCashStatus,
    createBuilding,
    updateBuilding,
    deleteBuilding,
    clearWorkspace,
  };
});
