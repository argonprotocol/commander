<template>
  <div
    ref="$el"
    :class="[hasFocus ? 'z-90' : '']"
    class="relative focus-within:relative"
    tabindex="0"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <div v-if="!props.disabled">
      <div
        @pointerdown="handlePointerDown"
        @pointerup="handlePointerUp"
        @pointermove="emitDrag"
        @pointercancel="handlePointerUp"
        class="absolute top-[-2px] left-0 h-[5px] w-full cursor-n-resize"
      />
      <div
        @pointerdown="handlePointerDown"
        @pointerup="handlePointerUp"
        @pointermove="emitDrag"
        @pointercancel="handlePointerUp"
        class="absolute bottom-[-2px] left-0 h-[5px] w-full cursor-s-resize"
      />
    </div>
    <div
      :class="[
        props.disabled ? 'border-dashed cursor-default' : '',
        hasFocus ? 'bg-slate-500/5 inner-input-shadow outline-2 -outline-offset-2 outline-argon-button' : '',
        [!hasFocus && !props.disabled ? 'hover:bg-white' : ''],
      ]"
      class="min-w-20 font-mono text-md flex flex-row w-full text-left py-[3px] border border-slate-700/50 rounded-md text-gray-800"
    >
      <span class="select-none pl-[10px] py-[1px]">{{ prefix }}</span>
      <div
        :contenteditable="!props.disabled"
        ref="inputElem"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
        @beforeinput="handleBeforeInput($event as InputEvent)"
        @paste="handlePaste($event as ClipboardEvent)"
        @keydown="handleKeyDown($event)"
        :class="[props.disabled ? 'opacity-70' : '']"
        class="inline-block w-auto focus:outline-none py-[1px]"
      ></div>
      <span
        :class="[props.disabled ? 'pointer-events-none' : '', suffix[0] === ' ' ? 'pl-[6px]' : 'pl-[2px]']"
        class="grow opacity-80 select-none pr-2 min-w-4 relative cursor-default py-[1px]"
      >
        {{ suffix }}
        <span
          @click="moveCursorToEnd"
          @dblclick="selectAllText"
          class="absolute top-0 left-0 w-full h-full cursor-text"
        />
      </span>

      <Menu v-if="props.options.length > 0">
        <MenuButton
          as="button"
          @click="toggleMenu"
          :class="[showMenu ? 'text-gray-900' : 'text-gray-400']"
          class="mr-2 text-md font-semibold focus:outline-none cursor-pointer hover:text-gray-900"
        >
          <LightBulbIcon class="size-[18px] text-inherit" />
        </MenuButton>
        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <MenuItems
            v-if="showMenu"
            class="absolute top-full -translate-y-1 z-20 right-0 h-auto max-h-80 w-auto max-w-100 bg-argon-menu-bg border border-gray-500/40 rounded-md px-0.5 py-0.5 shadow-md focus:outline-none"
          >
            <div class="absolute -top-[9px] right-[29.5px] w-[20px] h-[9px] overflow-hidden pointer-events-none">
              <div
                class="relative top-[5px] left-[5px] w-[15px] h-[15px] rotate-45 bg-slate-50 ring-1 ring-gray-900/20"
              ></div>
            </div>
            <div class="flex flex-col w-full h-full overflow-y-auto">
              <MenuItem
                v-for="option of props.options"
                v-slot="{ active: isActive }"
                :value="option.value"
                @click.stop="selectItem(option)"
                :class="option.description ? 'border-b border-gray-500/20 last:border-b-0' : ''"
                class="text-md font-mono text-left font-bold text-gray-800 py-1 first:rounded-t last:rounded-b"
              >
                <div
                  :class="[isActive ? 'bg-argon-button text-white' : '']"
                  class="flex flex-col pr-3 pl-2 py-0 cursor-pointer"
                >
                  <div class="flex flex-row justify-between items-center">
                    <div class="whitespace-nowrap grow pr-3">
                      {{ option.title || numeral(option.value).format('0,0') }}
                    </div>
                    <div v-if="option.value !== undefined" class="opacity-70 font-light relative">
                      {{ formatFn(option.value) }}
                    </div>
                  </div>
                  <div v-if="option.description" class="font-sans opacity-50 font-light">
                    {{ option.description }}
                  </div>
                </div>
              </MenuItem>
            </div>
          </MenuItems>
        </transition>
      </Menu>

      <div v-if="!props.disabled" class="flex flex-col mr-2">
        <NumArrow
          @mousedown="startContinuousIncrement"
          @mouseup="stopContinuousUpdates"
          @mouseleave="stopContinuousUpdates"
          class="relative top-[1px] size-[12px] text-gray-300 cursor-pointer hover:text-gray-600"
        />
        <NumArrow
          @mousedown="startContinuousDecrement"
          @mouseup="stopContinuousUpdates"
          @mouseleave="stopContinuousUpdates"
          class="relative top-[-1px] size-[12px] text-gray-300 rotate-180 cursor-pointer hover:text-gray-600"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { LightBulbIcon } from '@heroicons/vue/24/outline';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import NumArrow from '../assets/num-arrow.svg?component';
import { useCurrency } from '../stores/currency';
import numeral from '../lib/numeral';

const currency = useCurrency();

const props = withDefaults(
  defineProps<{
    modelValue: number | bigint;
    max?: number | bigint;
    min?: number | bigint;
    options?: any[];
    dragBy?: number;
    dragByMin?: number;
    disabled?: boolean;
    prefix?: string;
    format?: 'argons' | 'percent' | 'integer' | 'minutes';
  }>(),
  {
    options: () => [],
    dragBy: 1,
    dragByMin: 0.01,
    prefix: '',
    disabled: false,
    format: 'integer',
  },
);

const isBigInt = typeof props.modelValue === 'bigint';
const minValue: number | bigint = props.min || 0;
const maxValue: number | bigint = props.max || 0;

let loginValueOriginal = props.modelValue;
let loginValueConverted = originalToConverted(props.modelValue);

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | bigint): void;
}>();

const showMenu = Vue.ref(false);
const $el = Vue.ref<HTMLElement | null>(null);
const inputElem = Vue.ref<HTMLInputElement | null>(null);
const hasFocus = Vue.ref(false);

// Add timer refs for continuous updates
const incrementTimer = Vue.ref<number | null>(null);
const decrementTimer = Vue.ref<number | null>(null);
const initialDelay = 500; // Initial delay before starting continuous updates
const updateInterval = 50; // Interval between updates once continuous mode starts

const prefix = Vue.computed(() => {
  return props.prefix + (props.format === 'argons' ? currency.symbol : '');
});

const suffix = Vue.computed(() => {
  if (props.format === 'percent') {
    return '%';
  } else if (props.format === 'minutes') {
    return loginValueConverted === 1 ? ' minute' : ' minutes';
  } else {
    return '';
  }
});

function originalToConverted(valueOriginal: number | bigint): number {
  return props.format === 'argons' ? currency.microgonTo(valueOriginal as bigint) : Number(valueOriginal);
}

function convertedToOriginal(convertedValue: number): number | bigint {
  return props.format === 'argons' ? currency.toMicrogon(convertedValue) : convertedValue;
}

function updateInputValue(valueConverted: number) {
  let valueOriginal = convertedToOriginal(valueConverted);

  if (maxValue !== undefined && valueOriginal > maxValue) {
    valueOriginal = maxValue;
    valueConverted = originalToConverted(valueOriginal);
  }
  if (minValue !== undefined && valueOriginal < minValue) {
    valueOriginal = minValue;
    valueConverted = originalToConverted(valueOriginal);
  }

  loginValueOriginal = valueOriginal;
  loginValueConverted = valueConverted;

  emit('update:modelValue', isBigInt ? BigInt(valueOriginal) : valueOriginal);
  insertIntoInputElem(valueConverted);
}

function insertIntoInputElem(convertedValue: number) {
  if (!inputElem.value) return;

  const hasFocus = document.activeElement === inputElem.value;
  const caretPosition = hasFocus ? getCaretPosition() : 0;
  inputElem.value.textContent = formatFn(convertedValue);
  if (hasFocus) {
    setCaretPosition(caretPosition);
  }
}

function formatFn(value: number) {
  return numeral(value).formatIfElse(x => x.toString().split('.')[1]?.length > 0, '0,0.00', '0,0');
}

function moveCursorToEnd() {
  inputElem.value?.focus();
  const range = document.createRange();
  const selection = window.getSelection();
  if (inputElem.value?.firstChild) {
    range.setStartAfter(inputElem.value.firstChild);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
function handleFocus() {
  if (props.disabled) return;

  // Check if focus is coming from a text selection
  const selection = window.getSelection();
  if (selection && selection.toString().length > 0) {
    return;
  }

  hasFocus.value = true;
}

function handleBlur() {
  const activeElement = document.activeElement;
  if (showMenu.value) return;
  if (!activeElement || !$el.value?.contains(activeElement)) {
    hasFocus.value = false;
    updateInputValue(loginValueConverted);
  }
}

let startDragY: number | null = null;
let startValue: number = loginValueConverted;
let isDragging = false;
let minStepsUp: number = 0;
let minStepsDown: number = 0;
let stepsDownUntilDragBy: number = 0;

function handlePointerDown(event: PointerEvent) {
  const button = event.currentTarget as HTMLButtonElement;
  if (!button) return;

  // Only allow focus if it's a click (not a drag)
  if (event.pointerType === 'mouse') {
    const isClick = event.buttons === 1 && !event.isPrimary;
    if (!isClick) {
      event.preventDefault();
    }
  }

  button.setPointerCapture(event.pointerId);
  startDragY = event.clientY;
  startValue = loginValueConverted;

  // Calculate steps needed to reach nearest integers
  if (startValue % 1 !== 0) {
    const minStep = props.dragByMin || props.dragBy;
    const nextIntegerUp = Math.ceil(startValue);
    const nextIntegerDown = Math.floor(startValue);

    minStepsUp = Math.round((nextIntegerUp - startValue) / minStep);
    minStepsDown = Math.round((startValue - nextIntegerDown) / minStep);
  } else {
    minStepsUp = 0;
    minStepsDown = 0;
  }

  // Calculate steps needed to reach dragBy
  if (startValue > props.dragBy) {
    stepsDownUntilDragBy = Math.floor(startValue) - props.dragBy;
  } else {
    stepsDownUntilDragBy = 0;
  }
}

function emitDrag(event: PointerEvent) {
  if (startDragY === null) return;

  const currentY = event.clientY;
  const deltaY = startDragY - currentY; // Inverted to make dragging up increase value
  const direction = Math.sign(deltaY);
  const totalSteps = Math.abs(deltaY);

  let newValue = startValue;
  let remainingSteps = totalSteps;

  const minStep = props.dragByMin || props.dragBy;
  const stepsToInteger = direction > 0 ? minStepsUp : minStepsDown;

  if (remainingSteps <= stepsToInteger) {
    // Still in decimal territory, use min steps
    newValue += direction * remainingSteps * minStep;
    remainingSteps = 0;
  } else {
    // Cross into integer territory
    newValue += direction * stepsToInteger * minStep;
    remainingSteps -= stepsToInteger;
  }

  let remainingSmallSteps = 0;
  // Handle remaining steps with normal step size
  if (direction < 0 && remainingSteps > stepsDownUntilDragBy) {
    remainingSmallSteps = remainingSteps - stepsDownUntilDragBy;
    remainingSteps = stepsDownUntilDragBy;
  }

  if (remainingSteps) {
    let stepSize = props.dragBy;
    newValue += direction * remainingSteps * stepSize;
  }

  if (remainingSmallSteps) {
    let stepSize = props.dragByMin || props.dragBy;
    newValue += direction * remainingSmallSteps * stepSize;
  }

  // Apply min/max constraints
  if (minValue !== undefined && newValue < minValue) {
    newValue = minValue;
  }
  if (maxValue !== undefined && newValue > maxValue) {
    newValue = maxValue;
  }

  // Update visual feedback
  if (newValue > loginValueConverted) {
    document.body.classList.add('isDraggingIncrease');
    document.body.classList.remove('isDraggingDecrease');
  } else if (newValue < loginValueConverted) {
    document.body.classList.add('isDraggingDecrease');
    document.body.classList.remove('isDraggingIncrease');
  }

  if (newValue !== loginValueConverted) {
    isDragging = true;
    updateInputValue(newValue);
  }
}

function handlePointerUp(event: PointerEvent) {
  const button = event.currentTarget as HTMLButtonElement;
  if (!button) return;

  button.releasePointerCapture(event.pointerId);
  document.body.classList.remove('isDraggingIncrease');
  document.body.classList.remove('isDraggingDecrease');
  startDragY = null;
  setTimeout(() => {
    isDragging = false;
  }, 100);
}

function selectItem(item: any) {
  showMenu.value = false;
  if (item.value !== undefined) {
    updateInputValue(item.value);
  }
}

function toggleMenu() {
  if (isDragging) {
    return;
  }
  showMenu.value = !showMenu.value;
  setTimeout(() => $el.value?.focus(), 0);
}

function handleBeforeInput(event: InputEvent) {
  if (event.inputType === 'insertText') {
    const char = event.data;
    if (char && !/[\d,.]/.test(char)) {
      event.preventDefault();
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text') || '';
  const sanitizedText = pastedText.replace(/[^\d,.]/g, '');

  const target = event.target as HTMLElement;
  if (!target) return;

  // Get current cursor position
  const selection = window.getSelection();
  const range = selection?.getRangeAt(0);
  const cursorOffset = range?.startOffset || 0;

  // Insert the sanitized text at cursor position
  const currentText = target.textContent || '';
  const newText = currentText.slice(0, cursorOffset) + sanitizedText + currentText.slice(cursorOffset);

  // Ensure only one decimal point
  const parts = newText.split('.');
  const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : newText;

  target.textContent = finalValue;

  // Set cursor position after the pasted text
  if (selection && range) {
    const newCursorPos = cursorOffset + sanitizedText.length;
    const newRange = document.createRange();
    newRange.setStart(target.firstChild || target, newCursorPos);
    newRange.setEnd(target.firstChild || target, newCursorPos);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  const numericValue = Number(finalValue.replace(/,/g, ''));
  if (!isNaN(numericValue)) {
    updateInputValue(numericValue);
  }
}

function handleInput() {
  const currentText = inputElem.value?.textContent || '';
  const numericValue = Number(currentText.replace(/,/g, ''));
  if (!isNaN(numericValue)) {
    updateInputValue(numericValue);
  }
}

function getCaretPosition() {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode || !inputElem.value) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(inputElem.value);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function setCaretPosition(position: number) {
  if (!inputElem.value) return;

  const selection = window.getSelection();
  const range = document.createRange();
  const textNode = inputElem.value.firstChild || inputElem.value;

  // Ensure position is within bounds
  const maxLength = (inputElem.value.textContent || '').length;
  position = Math.min(Math.max(0, position), maxLength);

  range.setStart(textNode, position);
  range.setEnd(textNode, position);

  selection?.removeAllRanges();
  selection?.addRange(range);
}

function incrementValue() {
  const startValue = loginValueConverted;
  const caretPosition = getCaretPosition();

  let incrementBy = props.dragBy;
  if (startValue < props.dragBy) {
    incrementBy = props.dragByMin || props.dragBy;
  } else if (startValue % 1 !== 0) {
    incrementBy = props.dragByMin || props.dragBy;
  }
  const newValue = startValue + incrementBy;
  updateInputValue(newValue);
  setCaretPosition(caretPosition);
}

function decrementValue() {
  const startValue = loginValueConverted;
  const caretPosition = getCaretPosition();

  let decrementBy = props.dragBy;
  if (startValue <= props.dragBy) {
    decrementBy = props.dragByMin || props.dragBy;
  } else if (startValue % 1 !== 0) {
    decrementBy = props.dragByMin || props.dragBy;
  }
  const newValue = startValue - decrementBy;
  updateInputValue(newValue);
  setCaretPosition(caretPosition);
}

function startContinuousIncrement() {
  // Clear any existing timers
  stopContinuousUpdates();

  // Initial increment
  incrementValue();

  // Start continuous updates after initial delay
  incrementTimer.value = window.setTimeout(() => {
    const intervalId = window.setInterval(() => {
      incrementValue();
    }, updateInterval);

    // Store the interval ID in the timer ref
    incrementTimer.value = intervalId;
  }, initialDelay);
}

function startContinuousDecrement() {
  try {
    // Clear any existing timers
    stopContinuousUpdates();

    // Initial decrement
    decrementValue();

    // Start continuous updates after initial delay
    decrementTimer.value = window.setTimeout(() => {
      const intervalId = window.setInterval(() => {
        decrementValue();
      }, updateInterval);

      // Store the interval ID in the timer ref
      decrementTimer.value = intervalId;
    }, initialDelay);
  } catch (error) {
    console.error('Error starting continuous decrement:', error);
  }
}

function stopContinuousUpdates() {
  if (incrementTimer.value !== null) {
    window.clearTimeout(incrementTimer.value);
    window.clearInterval(incrementTimer.value);
    incrementTimer.value = null;
  }
  if (decrementTimer.value !== null) {
    window.clearTimeout(decrementTimer.value);
    window.clearInterval(decrementTimer.value);
    decrementTimer.value = null;
  }
}

function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (!target) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    decrementValue();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    incrementValue();
  } else if (event.key === 'Enter') {
    event.preventDefault();
  }
}

function selectAllText() {
  if (!inputElem.value) return;

  const range = document.createRange();
  range.selectNodeContents(inputElem.value);
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

Vue.watch(
  () => props.modelValue,
  newModelValue => {
    const valueConverted = originalToConverted(Number(newModelValue));
    if (valueConverted !== loginValueConverted) {
      updateInputValue(valueConverted);
    }
  },
);

Vue.watch(
  () => props.min,
  newMin => {
    const newMinValue = typeof newMin === 'bigint' ? Number(newMin) : newMin;
    if (newMinValue !== undefined && loginValueConverted < newMinValue) {
      updateInputValue(newMinValue);
    }
  },
  { immediate: true },
);

Vue.onMounted(() => {
  insertIntoInputElem(loginValueConverted);
});
</script>

<style scoped>
@reference "../main.css";

ul {
  @apply flex flex-col;
}

ul li {
  @apply border-b border-gray-300;
  &:first-child div {
    @apply rounded-t-md;
  }
  &:last-child {
    @apply rounded-b-md border-b-0;
  }
}
</style>
