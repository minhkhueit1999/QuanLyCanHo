<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="text-xs font-semibold text-ink">Kho ảnh phòng trong MongoDB ({{ library.length }})</p>
        <p class="text-[11px] text-muted">Chọn ảnh mẫu có sẵn hoặc tải ảnh mới trực tiếp vào Database (≤ 5MB)</p>
      </div>

      <label
        class="btn-gold-pill min-h-[40px] px-3.5 py-1.5 text-xs"
        :class="{ 'pointer-events-none opacity-50': uploading || disabled }"
      >
        <Loader2 v-if="uploading" class="h-3.5 w-3.5 animate-spin" />
        <Upload v-else class="h-3.5 w-3.5" />
        <span>{{ uploading ? 'Đang lưu vào DB...' : 'Tải ảnh từ máy' }}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          class="sr-only"
          :disabled="uploading || disabled"
          @change="handleFileSelect"
        />
      </label>
    </div>

    <div v-if="loading" class="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <div v-for="n in 4" :key="n" class="h-20 animate-pulse rounded-xs border border-hairline bg-surface-alt"></div>
    </div>

    <div v-else-if="library.length === 0" class="rounded-xs border border-dashed border-hairline bg-canvas p-4 text-center text-xs text-muted">
      Chưa có ảnh nào trong kho. Hãy tải ảnh lên để lưu trực tiếp vào MongoDB.
    </div>

    <div v-else class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      <div
        v-for="photo in library"
        :key="photo._id"
        class="group relative overflow-hidden rounded-xs border bg-surface transition cursor-pointer"
        :class="
          isSelected(photo._id)
            ? 'border-primary ring-2 ring-gold/60'
            : 'border-hairline hover:border-gold'
        "
        role="checkbox"
        tabindex="0"
        :aria-checked="isSelected(photo._id)"
        @click="togglePhoto(photo._id)"
        @keydown.enter.prevent="togglePhoto(photo._id)"
        @keydown.space.prevent="togglePhoto(photo._id)"
      >
        <div class="relative aspect-[16/10] w-full bg-surface-alt">
          <img
            :src="resolveMediaUrl(photo.url)"
            :alt="photo.title || photo.filename"
            class="h-full w-full object-cover"
            loading="lazy"
          />

          <span
            class="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            :class="photo.isSeedLibrary ? 'bg-wood-deep/80 text-gold' : 'bg-status-available/90 text-white'"
          >
            {{ photo.isSeedLibrary ? 'Kho mẫu' : 'Tải lên' }}
          </span>

          <span
            class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border text-white transition"
            :class="
              isSelected(photo._id)
                ? 'border-primary bg-primary'
                : 'border-white/70 bg-wood-deep/40 text-transparent'
            "
          >
            <Check class="h-3 w-3" />
          </span>

          <button
            v-if="!photo.isSeedLibrary"
            type="button"
            class="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-wood-deep/80 text-white opacity-90 transition hover:bg-primary cursor-pointer"
            title="Xóa ảnh tải lên khỏi MongoDB"
            aria-label="Xóa ảnh khỏi MongoDB"
            @click.stop="removeUploadedPhoto(photo)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>

        <p class="truncate px-2 py-1 text-[11px] font-medium text-ink">
          {{ photo.title || photo.filename }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { Upload, Loader2, Check, Trash2 } from 'lucide-vue-next';
import api, { getErrorMessage } from '@/api/axios';
import { useToastStore } from '@/stores/toast';
import { useWorkspaceStore } from '@/stores/workspace';
import { resolveMediaUrl } from '@/utils/format';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  roomId: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'uploaded', 'deleted']);
const toastStore = useToastStore();
const workspaceStore = useWorkspaceStore();

const library = ref([]);
const loading = ref(false);
const uploading = ref(false);

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

function isSelected(id) {
  return props.modelValue.map(String).includes(String(id));
}

function togglePhoto(id) {
  if (props.disabled) return;
  const sid = String(id);
  const current = props.modelValue.map(String);
  const next = current.includes(sid)
    ? current.filter((x) => x !== sid)
    : [...current, sid];
  emit('update:modelValue', next);
}

async function fetchLibrary() {
  if (!workspaceStore.currentBuildingId) return;
  loading.value = true;
  try {
    const res = await api.get('/rooms/photos/library');
    library.value = res.data.data || [];
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    loading.value = false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Không đọc được file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function handleFileSelect(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;

  uploading.value = true;
  try {
    const nextIds = [...props.modelValue.map(String)];
    let uploadedCount = 0;

    for (const file of files) {
      if (!ALLOWED_MIMES.has(file.type)) {
        toastStore.warning(`${file.name}: chỉ hỗ trợ JPEG, PNG, WebP`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toastStore.warning(`${file.name}: vượt quá giới hạn 5MB`);
        continue;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.post('/rooms/photos/upload', {
        filename: file.name,
        contentType: file.type,
        base64Data: dataUrl,
        title: file.name.replace(/\.[^/.]+$/, ''),
        room_id: props.roomId || null,
      });
      const created = res.data.data;
      library.value.unshift(created);
      if (!nextIds.includes(String(created._id))) {
        nextIds.push(String(created._id));
      }
      uploadedCount += 1;
      emit('uploaded', created);
    }

    if (uploadedCount > 0) {
      emit('update:modelValue', nextIds);
      toastStore.success(`Đã lưu ${uploadedCount} ảnh vào MongoDB`);
    }
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  } finally {
    uploading.value = false;
  }
}

async function removeUploadedPhoto(photo) {
  try {
    await api.delete(`/rooms/photos/${photo._id}`);
    library.value = library.value.filter((p) => String(p._id) !== String(photo._id));
    emit(
      'update:modelValue',
      props.modelValue.map(String).filter((id) => id !== String(photo._id))
    );
    emit('deleted', photo._id);
    toastStore.success('Đã xóa ảnh khỏi MongoDB');
  } catch (err) {
    toastStore.error(getErrorMessage(err));
  }
}

watch(
  () => workspaceStore.currentBuildingId,
  (id) => {
    if (id) fetchLibrary();
  }
);

onMounted(() => {
  fetchLibrary();
});

defineExpose({ fetchLibrary });
</script>
