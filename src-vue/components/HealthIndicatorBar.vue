<template>
  <div
    class="absolute -bottom-2 left-[calc(50%-0px)] flex h-[10px] w-8/12 -translate-x-1/2 translate-y-full flex-row items-center space-x-1 xl:left-[calc(50%-10px)]"
  >
    <div v-for="i in 20" :key="i" class="hidden h-full w-1/20 min-w-1 rounded-full bg-green-800/70 xl:block"></div>
    <div v-for="i in 10" :key="i" class="block h-full w-1/20 min-w-1 rounded-full bg-green-800/70 xl:hidden"></div>
    <div class="text-slate-900/50">100%</div>
  </div>
</template>
