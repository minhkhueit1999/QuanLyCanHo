<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <div class="flex items-center gap-4">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-xs bg-primary"></span>
          Đã thu
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-xs border border-gold bg-gold/30"></span>
          Còn phải thu
        </span>
      </div>
      <span>Đơn vị: VNĐ</span>
    </div>

    <div
      class="relative flex h-60 items-end justify-between gap-3 rounded-xs border border-hairline bg-canvas/70 px-4 pb-9 pt-8 sm:gap-5 sm:px-6"
      role="img"
      aria-label="Biểu đồ doanh thu 6 tháng gần nhất"
    >
      <div class="pointer-events-none absolute inset-x-4 bottom-9 top-8 flex flex-col justify-between">
        <div v-for="t in 4" :key="t" class="border-b border-dashed border-hairline"></div>
      </div>

      <div
        v-for="item in data"
        :key="item.month"
        class="group relative z-10 flex h-full flex-1 flex-col items-center justify-end"
        tabindex="0"
      >
        <div
          class="pointer-events-none absolute -top-2 z-20 hidden -translate-y-full whitespace-nowrap rounded-xs border border-gold/50 bg-wood-deep px-3 py-2 text-xs text-white shadow-canho group-hover:block group-focus:block"
        >
          <p class="font-semibold text-gold">{{ item.month }}</p>
          <p class="tabular-nums">Đã thu: {{ formatCurrency(item.paidRevenue) }}</p>
          <p class="tabular-nums text-white/80">Còn thu: {{ formatCurrency(item.unpaidRevenue) }}</p>
        </div>

        <div class="flex h-full w-full max-w-[44px] flex-col justify-end gap-0.5">
          <div
            v-if="item.unpaidRevenue > 0"
            class="w-full rounded-t-xs border border-gold bg-gold/35 transition-all"
            :style="{ height: barHeight(item.unpaidRevenue) }"
          ></div>
          <div
            class="w-full bg-primary transition-all"
            :class="item.unpaidRevenue > 0 ? 'rounded-b-xs' : 'rounded-xs'"
            :style="{
              height: item.paidRevenue > 0 ? barHeight(item.paidRevenue) : item.totalBilled === 0 ? '4px' : '0px',
              opacity: item.totalBilled === 0 ? 0.2 : 1,
            }"
          ></div>
        </div>

        <span class="absolute -bottom-6 text-xs font-semibold text-ink">{{ item.label }}</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <div
        v-for="item in data"
        :key="item.month + '-cell'"
        class="rounded-xs border border-hairline bg-surface-alt/60 px-2.5 py-2 text-center"
      >
        <p class="text-[11px] text-muted">{{ item.month }}</p>
        <p class="mt-0.5 text-xs font-bold text-primary tabular-nums">
          {{ compact(item.paidRevenue) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatCurrency } from '@/utils/format';

const props = defineProps({
  data: { type: Array, default: () => [] },
});

const maxTotal = computed(() =>
  Math.max(...props.data.map((d) => Number(d.totalBilled) || 0), 1)
);

function barHeight(val) {
  const pct = (Number(val) / maxTotal.value) * 100;
  return `${Math.max(pct, val > 0 ? 5 : 0)}%`;
}

function compact(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}đ`;
}
</script>
