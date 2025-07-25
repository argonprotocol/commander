<!-- prettier-ignore -->
<template>
  <input
    type="radio"
    @click="handleClick"
    :name="props.name"
    class="relative size-5 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1.5 before:rounded-full before:bg-white checked:border-argon-button checked:bg-argon-button"
  />
</template>

<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['click']);

function handleClick(event) {
  emit('click', event);
}
</script>
