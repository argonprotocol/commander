<template>
  <div
    class="flex flex-row absolute -bottom-2 left-[calc(50%-0px)] xl:left-[calc(50%-10px)] -translate-x-1/2 translate-y-full items-center space-x-1 w-8/12 h-[10px]"
  >
    <div v-for="i in 20" :key="i" class="h-full bg-green-800/70 rounded-full w-1/20 min-w-1 hidden xl:block"></div>
    <div v-for="i in 10" :key="i" class="h-full bg-green-800/70 rounded-full w-1/20 min-w-1 block xl:hidden"></div>
    <div class="text-slate-900/50">100%</div>
  </div>
</template>
