import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([]);
  let nextId = 1;

  function addToast(message, type = 'info', duration = 3500) {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function success(message) {
    return addToast(message, 'success');
  }

  function error(message) {
    return addToast(message, 'error', 4800);
  }

  function warning(message) {
    return addToast(message, 'warning', 4200);
  }

  function info(message) {
    return addToast(message, 'info');
  }

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
});
