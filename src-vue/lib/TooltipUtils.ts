import { type ComputedRef } from 'vue';
import basicEmitter from '../emitters/basicEmitter';

export function showTooltip(
  event: MouseEvent,
  label: string | ComputedRef<string>,
  flags: { width?: 'parent'; widthPlus?: number } = {},
) {
  event.stopPropagation();
  event.preventDefault();
  const targetElem = event.currentTarget as HTMLElement;
  if (!targetElem) return;

  const targetRect = targetElem.getBoundingClientRect();

  let width: 'parent' | 'auto' | 'auto-plus' = 'auto';
  let horizontalPosition: 'left' | 'center' | 'right' = 'center';
  let verticalPosition: 'above' | 'below' = 'above';

  if (flags.width == 'parent') {
    width = 'parent';
  }

  basicEmitter.emit('showTooltip', {
    parentLeft: targetRect.left,
    parentTop: targetRect.top,
    parentWidth: targetRect.width,
    parentHeight: targetRect.height,
    label,
    width,
    widthPlus: flags.widthPlus || 0,
    horizontalPosition,
    verticalPosition,
  });
}

export function hideTooltip() {
  basicEmitter.emit('hideTooltip');
}
