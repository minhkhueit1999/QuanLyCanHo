<template>
  <article
    class="group flex flex-col justify-between overflow-hidden rounded-xs border border-hairline bg-surface shadow-canho transition hover:border-gold"
  >
    <div>
      <!-- 1. Media Frame (8px inner frame per DESIGN.md) -->
      <div class="p-2.5 pb-0">
        <div
          class="relative aspect-[16/10] w-full overflow-hidden rounded-sm border border-hairline bg-surface-alt cursor-pointer"
          role="button"
          tabindex="0"
          :aria-label="`Xem chi tiết Phòng ${room.roomCode}`"
          @click="$emit('detail', room)"
          @keydown.enter="$emit('detail', room)"
        >
          <img
            v-if="photos.length > 0"
            :src="activePhotoSrc"
            :alt="`Phòng ${room.roomCode} - ảnh ${activeIndex + 1}`"
            class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
            <Building2 class="h-8 w-8 text-gold/70" />
            <span class="font-serif text-xs font-medium text-ink/70">canho.com • Chưa có ảnh</span>
          </div>

          <!-- Status Pill Top-Left -->
          <span
            class="absolute left-2.5 top-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
            :class="statusMeta.badgeClass"
          >
            {{ statusMeta.label }}
          </span>

          <!-- Context Pill Top-Right -->
          <span
            v-if="mode === 'explore' && room.building?.province_name"
            class="absolute right-2.5 top-2.5 rounded-full border border-gold/40 bg-wood-deep/85 px-2.5 py-0.5 text-[11px] font-medium text-gold backdrop-blur-sm"
          >
            {{ room.building.province_name }}
          </span>
          <span
            v-else-if="mode === 'workspace' && room.approvalStatus === 'pending'"
            class="absolute right-2.5 top-2.5 rounded-full border border-gold/60 bg-gold-tint/95 px-2.5 py-0.5 text-[11px] font-semibold text-wood"
          >
            Chờ Admin duyệt
          </span>

          <!-- Prev/Next Photo Controls -->
          <template v-if="photos.length > 1">
            <button
              type="button"
              class="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gold/40 bg-wood-deep/75 text-white transition hover:bg-primary cursor-pointer"
              aria-label="Ảnh trước"
              @click.stop="prevPhoto"
            >
              <ChevronLeft class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gold/40 bg-wood-deep/75 text-white transition hover:bg-primary cursor-pointer"
              aria-label="Ảnh tiếp theo"
              @click.stop="nextPhoto"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
            <span
              class="absolute bottom-2 right-2 rounded-full bg-wood-deep/80 px-2.5 py-0.5 text-[11px] font-medium text-white tabular-nums"
            >
              {{ activeIndex + 1 }} / {{ photos.length }}
            </span>
          </template>
        </div>
      </div>

      <!-- 2. Room Header, Location / Occupant Meta & Amenities -->
      <div class="space-y-3 p-4">
        <div>
          <div class="flex items-start justify-between gap-2">
            <h3
              class="font-serif text-lg font-bold leading-snug text-ink hover:text-primary cursor-pointer"
              @click="$emit('detail', room)"
            >
              Phòng {{ room.roomCode }}
            </h3>
            <span class="shrink-0 rounded-xs border border-hairline bg-surface-alt px-2 py-0.5 text-[11px] font-semibold text-ink tabular-nums">
              {{ room.area }} m²
            </span>
          </div>

          <p class="mt-0.5 text-xs text-muted tabular-nums">
            Tầng {{ room.floor }} • Tối đa {{ room.maxOccupants }} người •
            {{ room.keysAndCards?.mechanicalKeys ?? 2 }} chìa cơ / {{ room.keysAndCards?.keyCards ?? 2 }} thẻ từ
          </p>
        </div>

        <!-- Mode: Explore Building & Location -->
        <div v-if="mode === 'explore'" class="space-y-1.5">
          <p class="font-serif text-sm font-bold text-ink">{{ room.building?.name || 'Tòa nhà canho.com' }}</p>
          <p class="flex items-start gap-1.5 text-xs text-muted">
            <MapPin class="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span class="line-clamp-2">
              {{ room.building?.address }}
              <template v-if="room.building?.ward_name || room.building?.province_name">
                ({{ room.building?.ward_name }}, {{ room.building?.province_name }})
              </template>
            </span>
          </p>
          <p v-if="room.description" class="line-clamp-2 text-xs leading-relaxed text-muted">
            {{ room.description }}
          </p>
        </div>

        <!-- Mode: Workspace Contract / Deposit Status -->
        <div v-else class="rounded-xs border border-hairline bg-canvas/70 px-3 py-2 text-xs">
          <p v-if="room.activeContract" class="truncate font-semibold text-primary">
            HĐ: {{ room.activeContract.occupants?.[0]?.fullName || room.activeContract.contractCode }}
          </p>
          <p v-else-if="room.activeDeposit" class="truncate font-semibold text-status-reserved">
            Giữ chỗ: {{ room.activeDeposit.user_id?.fullName || room.activeDeposit.depositCode }}
          </p>
          <p v-else-if="room.approvalStatus === 'pending'" class="font-medium text-wood">
            Đề xuất giá: {{ formatCurrency(room.proposedPrice || room.base_price) }} (Chờ Admin duyệt)
          </p>
          <p v-else class="truncate text-status-available">
            Sẵn sàng bàn giao • {{ (room.assets || []).length }} hạng mục tài sản
          </p>
        </div>

        <!-- Amenities Pills -->
        <div v-if="displayedAmenities.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="am in displayedAmenities"
            :key="am"
            class="rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-[11px] text-ink"
          >
            {{ am }}
          </span>
          <span
            v-if="remainingAmenitiesCount > 0"
            class="rounded-full border border-gold/40 bg-gold-tint px-2 py-0.5 text-[11px] font-semibold text-ink tabular-nums"
          >
            +{{ remainingAmenitiesCount }}
          </span>
        </div>
      </div>
    </div>

    <!-- 3. Price & Actions Footer -->
    <div class="space-y-3 border-t border-hairline bg-surface-alt/55 p-4">
      <div class="flex items-end justify-between gap-2">
        <div>
          <span class="block text-[11px] font-medium text-muted">Giá thuê niêm yết</span>
          <p class="font-serif text-xl font-bold leading-tight text-primary tabular-nums">
            {{ formatCurrency(room.base_price) }}
            <span class="font-sans text-xs font-normal text-muted">/tháng</span>
          </p>
        </div>
        <div class="text-right">
          <span class="block text-[11px] text-muted">Cọc mặc định</span>
          <span class="text-xs font-semibold text-ink tabular-nums">
            {{ formatCurrency(room.defaultDeposit ?? room.base_price) }}
          </span>
        </div>
      </div>

      <div v-if="mode === 'explore'" class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="btn-secondary-pill min-h-[44px] px-3 py-2 text-xs"
          @click="$emit('book', room)"
        >
          <Calendar class="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Đặt lịch xem</span>
        </button>
        <button
          type="button"
          class="btn-primary-pill min-h-[44px] px-3 py-2 text-xs"
          @click="$emit('deposit', room)"
        >
          <BookmarkCheck class="h-3.5 w-3.5 shrink-0" />
          <span>Đặt cọc giữ chỗ</span>
        </button>
      </div>

      <div v-else class="grid grid-cols-1 gap-2">
        <button
          type="button"
          class="btn-secondary-pill min-h-[44px] w-full px-3 py-2 text-xs"
          @click="$emit('detail', room)"
        >
          <Images class="h-3.5 w-3.5 text-primary" />
          <span>Chi tiết, Ảnh MongoDB &amp; Tài sản</span>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  Building2,
  MapPin,
  Calendar,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Images,
} from 'lucide-vue-next';
import { formatCurrency, resolveMediaUrl, ROOM_STATUS_META } from '@/utils/format';

const props = defineProps({
  room: { type: Object, required: true },
  mode: {
    type: String,
    default: 'explore',
    validator: (v) => ['explore', 'workspace'].includes(v),
  },
});

defineEmits(['detail', 'book', 'deposit']);

const activeIndex = ref(0);

const photos = computed(() => {
  const fromUrls = Array.isArray(props.room.images) ? props.room.images.filter(Boolean) : [];
  if (fromUrls.length > 0) return fromUrls;
  const fromIds = Array.isArray(props.room.photoIds)
    ? props.room.photoIds.map((id) => `/api/v1/rooms/photos/${id}`)
    : [];
  return fromIds;
});

watch(photos, () => {
  activeIndex.value = 0;
});

const activePhotoSrc = computed(() => resolveMediaUrl(photos.value[activeIndex.value] || ''));

const statusMeta = computed(
  () => ROOM_STATUS_META[props.room.status] || ROOM_STATUS_META.available
);

const displayedAmenities = computed(() => (props.room.amenities || []).slice(0, 4));
const remainingAmenitiesCount = computed(() =>
  Math.max(0, (props.room.amenities || []).length - 4)
);

function prevPhoto() {
  if (photos.value.length <= 1) return;
  activeIndex.value = (activeIndex.value - 1 + photos.value.length) % photos.value.length;
}

function nextPhoto() {
  if (photos.value.length <= 1) return;
  activeIndex.value = (activeIndex.value + 1) % photos.value.length;
}
</script>
