import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/axios';
import { getCurrentMonth } from '@/utils/format';

export const useBookingBillingStore = defineStore('bookingBilling', () => {
  const exploreRooms = ref([]);
  const viewBookings = ref([]);
  const deposits = ref([]);
  const contracts = ref([]);
  const worksheetMonth = ref(getCurrentMonth());
  const worksheetRows = ref([]);
  const commissions = ref([]);
  const cashPayments = ref([]);
  const loading = ref(false);

  async function searchPublicRooms(params = {}) {
    loading.value = true;
    try {
      const res = await api.get('/explore/rooms', { params });
      exploreRooms.value = res.data.data || [];
      return exploreRooms.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBuildingLeasingData() {
    loading.value = true;
    try {
      const [bkRes, depRes, ctRes] = await Promise.all([
        api.get('/bookings/building'),
        api.get('/deposits/building'),
        api.get('/contracts/building'),
      ]);
      viewBookings.value = bkRes.data.data || [];
      deposits.value = depRes.data.data || [];
      contracts.value = ctRes.data.data || [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchWorksheet(month = worksheetMonth.value) {
    loading.value = true;
    worksheetMonth.value = month;
    try {
      const res = await api.get('/invoices/worksheet', { params: { month } });
      worksheetRows.value = res.data.data?.rows || [];
      return worksheetRows.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCommissionsAndPayments() {
    loading.value = true;
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/commissions/building'),
        api.get('/payments/building'),
      ]);
      commissions.value = cRes.data.data || [];
      cashPayments.value = (pRes.data.data || []).filter(
        (p) => p.method === 'cash' && p.cashRemitStatus !== 'not_applicable'
      );
    } finally {
      loading.value = false;
    }
  }

  return {
    exploreRooms,
    viewBookings,
    deposits,
    contracts,
    worksheetMonth,
    worksheetRows,
    commissions,
    cashPayments,
    loading,
    searchPublicRooms,
    fetchBuildingLeasingData,
    fetchWorksheet,
    fetchCommissionsAndPayments,
  };
});
