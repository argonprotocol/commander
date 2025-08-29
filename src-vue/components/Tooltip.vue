<template>
  <TooltipProvider :disableHoverableContent="true">
    <TooltipRoot>
      <TooltipTrigger class="cursor-help">
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="-5"
          side="bottom"
          class="data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade text-md pointer-events-none z-100 max-w-[400px] rounded-md border border-gray-800/20 bg-white px-4 py-3 text-left leading-5.5 text-gray-600 shadow-xl will-change-[transform,opacity] select-none"
        >
          {{ content }}
          <TooltipArrow :width="24" :height="12" class="fill-white stroke-gray-400/50 shadow-2xl" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from 'reka-ui';
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  useForwardPropsEmits,
} from 'reka-ui';

const props = defineProps<TooltipRootProps & { content?: string }>();
const emits = defineEmits<TooltipRootEmits>();

const forward = useForwardPropsEmits(props, emits);
</script>
