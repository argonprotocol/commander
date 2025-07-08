import { type ComputedRef } from 'vue';
import emitter from '../emitters/basic';

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

  let width = 'auto';
  let horizontalPosition = 'center';
  let verticalPosition = 'above';

  if (flags.width == 'parent') {
    width = 'parent';
  }

  emitter.emit('showTooltip', {
    parentLeft: targetRect.left,
    parentTop: targetRect.top,
    parentWidth: targetRect.width,
    parentHeight: targetRect.height,
    label,
    width,
    widthPlus: flags.widthPlus,
    horizontalPosition,
    verticalPosition,
  });
}

export function hideTooltip() {
  emitter.emit('hideTooltip');
}
