<template>
  <div
    class="no-print pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2.5"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="item in toastStore.toasts"
        :key="item.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xs border px-4 py-3 shadow-canho backdrop-blur"
        :class="toastClasses(item.type)"
        role="status"
      >
        <component :is="toastIcon(item.type)" class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p class="flex-1 text-sm font-medium leading-snug">{{ item.message }}</p>
        <button
          type="button"
          class="rounded-full p-1 opacity-70 transition hover:opacity-100 cursor-pointer"
          aria-label="Đóng thông báo"
          @click="toastStore.removeToast(item.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

function toastClasses(type) {
  if (type === 'success') return 'border-status-available/30 bg-status-available-tint text-status-available';
  if (type === 'error') return 'border-status-occupied/40 bg-status-occupied-tint text-status-occupied';
  if (type === 'warning') return 'border-status-reserved/40 bg-status-reserved-tint text-status-reserved';
  return 'border-hairline bg-surface text-ink';
}

function toastIcon(type) {
  if (type === 'success') return CheckCircle2;
  if (type === 'error') return AlertCircle;
  if (type === 'warning') return AlertTriangle;
  return Info;
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
