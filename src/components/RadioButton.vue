<template>
  <input type="radio" :name="props.name" class="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white checked:border-indigo-600 checked:bg-indigo-600">
</template>

<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true
  }
})
</script>

