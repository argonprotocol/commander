  <template>
    <div v-if="props.isChecked" class="flex items-center justify-center min-w-8 min-h-8 w-8 h-8 border-4 mr-4 border-argon-button bg-argon-button">
      <svg class="pointer-events-none size-10 self-center justify-self-center stroke-white" viewBox="0 0 14 14" fill="none">
        <path class="opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    
    <div v-else-if="props.isPartiallyChecked" class="relative flex items-center justify-center min-w-8 min-h-8 w-8 h-8 border-4 mr-4 border-argon-button">
      <div class="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-t from-argon-button-hover/40 to-argon-button-hover/10" />
      <svg class="relative pointer-events-none size-10 self-center justify-self-center stroke-white" viewBox="0 0 14 14" fill="none">
        <path class="opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div v-else class="min-w-8 min-h-8 w-8 h-8 border-4 border-slate-400 mr-4" />
</template>

<script setup lang="ts">

const props = defineProps({
  isChecked: {
    type: Boolean,
    default: false
  },
  isPartiallyChecked: {
    type: Boolean,
    default: false
  }
});

</script>