<!-- prettier-ignore -->
<template>
  <div @focus="handleFocus" @blur="handleBlur" ref="$el" :class="[hasFocus ? 'z-90' : '']" class="relative focus-within:relative" tabindex="0">
    <div
      InputFieldWrapper
      :class="[
        props.disabled ? 'border-dashed' : '',
        hasFocus ? 'inner-input-shadow outline-2 -outline-offset-2 outline-argon-button' : '',
        [!hasFocus && !props.disabled ? 'hover:bg-white' : ''],
      ]"
      class="min-w-20 font-mono text-sm flex flex-row w-full text-left py-[3px] border border-slate-700/50 rounded-md text-gray-800 cursor-text"
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
      <span Suffix :class="[props.disabled ? 'pointer-events-none' : '', suffix[0] === ' ' ? 'pl-[6px]' : 'pl-[2px]']" class="grow opacity-80 select-none pr-2 min-w-4 relative cursor-text py-[1px]">
        <span v-if="suffix" class="inline-block">{{ suffix }}</span>
        <span @click="moveCursorToEnd" @dblclick="selectAllText" class="absolute top-0 left-0 w-full h-full" />
      </span>

      <Menu v-if="props.options.length > 0">
        <MenuButton
          as="button"
          @click="toggleMenu"
          :class="[showMenu ? 'text-gray-900' : 'text-gray-400']"
          class="mr-2 text-sm font-semibold focus:outline-none cursor-pointer hover:text-gray-900"
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
                class="text-sm font-mono text-left font-bold text-gray-800 py-1 first:rounded-t last:rounded-b"
              >
                <div :class="[isActive ? 'bg-argon-button text-white' : '']" class="flex flex-col pr-3 pl-2 py-0 cursor-pointer">
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

      <div NumArrows v-if="!props.disabled" class="flex flex-col mr-2">
        <NumArrow NumArrowUp
          @pointerdown="handlePointerDown"
          @pointerup="handlePointerUp"
          @pointermove="emitDrag"
          @pointercancel="handlePointerUp"
          class="relative top-[1px] size-[12px] text-gray-300 cursor-pointer hover:text-gray-600"
        />
        <NumArrow NumArrowDown
          @pointerdown="handlePointerDown"
          @pointerup="handlePointerUp"
          @pointermove="emitDrag"
          @pointercancel="handlePointerUp"
          class="relative top-[-1px] size-[12px] text-gray-300 rotate-180 cursor-pointer hover:text-gray-600"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import BigNumber from 'bignumber.js';
import { LightBulbIcon } from '@heroicons/vue/24/outline';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import NumArrow from '../assets/num-arrow.svg?component';
import { useCurrency } from '../stores/currency';
import numeral from '../lib/numeral';

const currency = useCurrency();

const props = withDefaults(
  defineProps<{
    modelValue: number;
    max?: number;
    min?: number;
    options?: any[];
    dragBy?: number;
    dragByMin?: number;
    disabled?: boolean;
    prefix?: string;
    suffix?: string;
    minDecimals?: number;
    maxDecimals?: number;
    format?: 'percent' | 'number' | 'minutes';
  }>(),
  {
    options: () => [],
    dragBy: 1,
    dragByMin: 0.01,
    prefix: '',
    suffix: '',
    disabled: false,
    format: 'number',
    minDecimals: 0,
    maxDecimals: 2,
  },
);

let currentInputValue = props.modelValue;
let lastValueBeforeMinIncrease = currentInputValue;

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const showMenu = Vue.ref(false);
const $el = Vue.ref<HTMLElement | null>(null);
const inputElem = Vue.ref<HTMLInputElement | null>(null);
const hasFocus = Vue.ref(false);

let incrementTimerId: number | null = null;
let decrementTimerId: number | null = null;
let minMaxInputValueTimeoutId: number | null = null;

// Add this after other module-level variables
let pendingCaretPosition: number | null = null;

// Configuration for continuous increment/decrement
const initialDelay = 500; // Initial delay before starting continuous updates
const updateInterval = 50; // Interval between updates once continuous mode starts

const suffix = Vue.computed(() => {
  let sfx = '';
  if (props.format === 'percent') {
    sfx = '%';
  } else if (props.format === 'minutes') {
    sfx = currentInputValue === 1 ? ' minute' : ' minutes';
  }

  if (props.suffix) {
    sfx += props.suffix;
  }

  return sfx;
});

function updateInputValue(inputValue: number, setAsLastValueBeforeMinIncrease: boolean = false) {
  const boundedInputValue = calculateBoundedInputValue(inputValue);
  currentInputValue = inputValue;

  if (minMaxInputValueTimeoutId) {
    window.clearTimeout(minMaxInputValueTimeoutId);
  }
  minMaxInputValueTimeoutId = null;

  if (setAsLastValueBeforeMinIncrease) {
    lastValueBeforeMinIncrease = inputValue;
  }

  if (boundedInputValue !== inputValue) {
    minMaxInputValueTimeoutId = window.setTimeout(() => {
      if (inputValue !== currentInputValue) return;
      updateInputValue(boundedInputValue);
    }, 1_000);
  }

  emit('update:modelValue', boundedInputValue);
  insertIntoInputElem(inputValue);
}

function calculateBoundedInputValue(inputValue: number) {
  if (props.max !== undefined && inputValue > props.max) {
    inputValue = props.max;
  }
  if (props.min !== undefined && inputValue < props.min) {
    inputValue = props.min;
  }
  return inputValue;
}

function insertIntoInputElem(rawValue: number) {
  if (!inputElem.value) return;

  const hasFocus = document.activeElement === inputElem.value;
  const oldValue = inputElem.value.textContent || '';
  const newValue = formatFn(rawValue);
  if (oldValue === newValue) {
    return;
  }

  const oldCaretPosition = hasFocus ? getCaretPosition() : 0;

  if (hasFocus) {
    // Use execCommand to preserve undo/redo stack
    const selection = window.getSelection();
    if (selection) {
      // Select all content
      const range = document.createRange();
      range.selectNodeContents(inputElem.value);
      selection.removeAllRanges();
      selection.addRange(range);

      // Insert the new text (this creates undo history)
      const result = document.execCommand('insertText', false, newValue);

      // Set caret position
      let newCaretPosition;
      if (pendingCaretPosition !== null) {
        newCaretPosition = pendingCaretPosition;
        pendingCaretPosition = null;
      } else {
        newCaretPosition = calculateAdjustedCaretPosition(oldValue, newValue, oldCaretPosition);
      }
      setCaretPosition(newCaretPosition);
    }
  } else {
    // If not focused, just set the content directly
    inputElem.value.textContent = newValue;
  }
}

function calculateAdjustedCaretPosition(oldText: string, newText: string, oldPosition: number): number {
  // If the cursor was at the end of the old text, keep it at the end of the new text
  if (oldPosition >= oldText.length) {
    return newText.length;
  }

  // Count numeric characters (digits and decimal points) up to the old position
  let numericCharsBeforeOldPosition = 0;
  for (let i = 0; i < Math.min(oldPosition, oldText.length); i++) {
    if (/[\d.]/.test(oldText[i])) {
      numericCharsBeforeOldPosition++;
    }
  }

  // Find the position in the new text that corresponds to the same number of numeric characters
  let numericCharsFound = 0;
  for (let i = 0; i < newText.length; i++) {
    if (/[\d.]/.test(newText[i])) {
      numericCharsFound++;
      if (numericCharsFound > numericCharsBeforeOldPosition) {
        return i;
      }
    }
  }

  // If we haven't found enough numeric characters, position at the end
  return newText.length;
}

function formatFn(value: number) {
  let decimalCount = value.toString().split('.')[1]?.length || 0;
  decimalCount = Math.min(decimalCount, props.maxDecimals);
  decimalCount = Math.max(decimalCount, props.minDecimals);
  const decimals = ''.padEnd(decimalCount, '0');
  return numeral(value).formatIfElse(!!decimals, `0,0.${decimals}`, '0,0');
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
    const boundedInputValue = calculateBoundedInputValue(currentInputValue);
    if (boundedInputValue !== currentInputValue) {
      updateInputValue(boundedInputValue);
    }
  }
}

let startDragY: number | null = null;
let startValue: number = currentInputValue;
let isDragging = false;
let minStepsUp: number = 0;
let minStepsDown: number = 0;
let stepsDownUntilDragBy: number = 0;
let startPointerX: number | null = null;
let startPointerY: number | null = null;
let isContinuousMode = false;
let continuousTimer: number | null = null;

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
  startValue = currentInputValue;
  startPointerX = event.clientX;
  startPointerY = event.clientY;
  isContinuousMode = false;

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

  // Start a timer to check if we should enter continuous mode
  continuousTimer = window.setTimeout(() => {
    if (startPointerX !== null && startPointerY !== null && !isDragging) {
      isContinuousMode = true;
      // Determine which arrow was clicked and start appropriate continuous function
      const isUpArrow = button.classList.contains('rotate-180') === false;
      if (isUpArrow) {
        startContinuousIncrement();
      } else {
        startContinuousDecrement();
      }
    }
  }, 500); // 500ms delay before starting continuous mode
}

function emitDrag(event: PointerEvent) {
  if (startDragY === null || startPointerX === null || startPointerY === null) return;

  const currentY = event.clientY;
  const currentX = event.clientX;
  const deltaY = startDragY - currentY; // Inverted to make dragging up increase value
  const deltaX = currentX - startPointerX;

  // Check if movement is more than 3 pixels in any direction
  const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (totalMovement > 3) {
    // Cancel continuous mode if we're moving significantly
    if (continuousTimer !== null) {
      window.clearTimeout(continuousTimer);
      continuousTimer = null;
    }
    if (isContinuousMode) {
      stopContinuousUpdates();
      isContinuousMode = false;
    }

    // Enter drag mode
    isDragging = true;

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
    if (props.min !== undefined && newValue < props.min) {
      newValue = props.min;
    }
    if (props.max !== undefined && newValue > props.max) {
      newValue = props.max;
    }

    // Update visual feedback
    if (newValue > currentInputValue) {
      document.body.classList.add('isDraggingIncrease');
      document.body.classList.remove('isDraggingDecrease');
    } else if (newValue < currentInputValue) {
      document.body.classList.add('isDraggingDecrease');
      document.body.classList.remove('isDraggingIncrease');
    }

    if (newValue !== currentInputValue) {
      updateInputValue(newValue, true);
    }
  }
}

function handlePointerUp(event: PointerEvent) {
  const button = event.currentTarget as HTMLButtonElement;
  if (!button) return;

  button.releasePointerCapture(event.pointerId);
  document.body.classList.remove('isDraggingIncrease');
  document.body.classList.remove('isDraggingDecrease');

  // Clear continuous timer
  if (continuousTimer !== null) {
    window.clearTimeout(continuousTimer);
    continuousTimer = null;
  }

  // Stop continuous updates if active
  if (isContinuousMode) {
    stopContinuousUpdates();
    isContinuousMode = false;
  }

  // If we didn't drag and didn't enter continuous mode, do a single increment/decrement
  if (!isDragging && !isContinuousMode && startPointerX !== null && startPointerY !== null) {
    const isUpArrow = button.classList.contains('rotate-180') === false;
    if (isUpArrow) {
      incrementValue();
    } else {
      decrementValue();
    }
  }

  startDragY = null;
  startPointerX = null;
  startPointerY = null;
  setTimeout(() => {
    isDragging = false;
  }, 100);
}

function selectItem(item: any) {
  showMenu.value = false;
  if (item.value !== undefined) {
    updateInputValue(item.value, true);
  }
}

function toggleMenu() {
  if (isDragging) {
    return;
  }
  showMenu.value = !showMenu.value;
  setTimeout(() => $el.value?.focus(), 0);
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text') || '';
  const sanitizedText = pastedText.replace(/[^\d,.]/g, '');

  const target = event.target as HTMLElement;
  if (!target) return;

  // Get current selection and cursor position
  const selection = window.getSelection();
  const range = selection?.getRangeAt(0);

  if (!selection || !range) return;

  // Get the start and end positions of the selection
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;
  const hasSelection = startOffset !== endOffset;

  // Get the current text content
  const currentText = target.textContent || '';

  let newText: string;
  let newCursorPos: number;

  if (hasSelection) {
    // Replace the selected text with the pasted text
    newText = currentText.slice(0, startOffset) + sanitizedText + currentText.slice(endOffset);
    newCursorPos = startOffset + sanitizedText.length;
  } else {
    // Insert at cursor position (no selection)
    newText = currentText.slice(0, startOffset) + sanitizedText + currentText.slice(startOffset);
    newCursorPos = startOffset + sanitizedText.length;
  }

  // Ensure only one decimal point
  const parts = newText.split('.');
  const finalValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : newText;

  // Set the pending caret position to after the pasted text (in terms of numeric chars)
  // We'll use this in insertIntoInputElem after formatting
  const numericValue = Number(finalValue.replace(/,/g, ''));
  const formatted = formatFn(numericValue);

  // Calculate the caret position
  let calculatedCaretPosition: number;
  // If the paste was at the end of the input, set caret to the end
  if (newCursorPos >= finalValue.length) {
    calculatedCaretPosition = formatted.length;
  } else {
    // Otherwise, count numeric chars up to newCursorPos in the unformatted string
    let numericChars = 0;
    for (let i = 0; i < Math.min(newCursorPos, finalValue.length); i++) {
      if (/\d|\./.test(finalValue[i])) numericChars++;
    }
    // Now, find the position in the formatted string after the same number of numeric chars
    let found = 0;
    calculatedCaretPosition = formatted.length; // Default to end
    for (let i = 0; i < formatted.length; i++) {
      if (/\d|\./.test(formatted[i])) {
        found++;
        if (found === numericChars) {
          // Place caret after the last pasted char
          calculatedCaretPosition = i + 1;
          break;
        }
      }
    }
  }

  pendingCaretPosition = calculatedCaretPosition;

  if (!isNaN(numericValue)) {
    updateInputValue(numericValue, true);
  }
}

function handleBeforeInput(event: InputEvent) {
  if (event.inputType === 'insertText') {
    const caretPosition = getCaretPosition();
    const char = event.data;
    if (caretPosition === 0 && char === '-') {
      return;
    } else if (char && !/[\d,.]/.test(char)) {
      event.preventDefault();
    }
  }
}

function handleInput() {
  const currentText = inputElem.value?.textContent || '';
  const numericValue = Number(currentText.replace(/,/g, ''));
  if (!isNaN(numericValue)) {
    updateInputValue(numericValue, true);
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
  const startValue = currentInputValue;

  let incrementBy = props.dragBy;
  if (startValue < props.dragBy) {
    incrementBy = props.dragByMin || props.dragBy;
  } else if (startValue % 1 !== 0) {
    incrementBy = props.dragByMin || props.dragBy;
  }
  const newValue = BigNumber(startValue).plus(incrementBy).toNumber();
  updateInputValue(newValue, true);
}

function decrementValue() {
  const startValue = currentInputValue;

  let decrementBy = props.dragBy;
  if (startValue <= props.dragBy) {
    decrementBy = props.dragByMin || props.dragBy;
  } else if (startValue % 1 !== 0) {
    decrementBy = props.dragByMin || props.dragBy;
  }
  const newValue = BigNumber(startValue).minus(decrementBy).toNumber();
  updateInputValue(newValue, true);
}

function startContinuousIncrement() {
  stopContinuousUpdates();
  incrementValue();

  incrementTimerId = window.setTimeout(() => {
    const intervalId = window.setInterval(() => {
      incrementValue();
    }, updateInterval);

    incrementTimerId = intervalId;
  }, initialDelay);
}

function startContinuousDecrement() {
  try {
    stopContinuousUpdates();
    decrementValue();

    decrementTimerId = window.setTimeout(() => {
      const intervalId = window.setInterval(() => {
        decrementValue();
      }, updateInterval);

      decrementTimerId = intervalId;
    }, initialDelay);
  } catch (error) {
    console.error('Error starting continuous decrement:', error);
  }
}

function stopContinuousUpdates() {
  if (incrementTimerId !== null) {
    window.clearTimeout(incrementTimerId);
    window.clearInterval(incrementTimerId);
    incrementTimerId = null;
  }
  if (decrementTimerId !== null) {
    window.clearTimeout(decrementTimerId);
    window.clearInterval(decrementTimerId);
    decrementTimerId = null;
  }
  if (continuousTimer !== null) {
    window.clearTimeout(continuousTimer);
    continuousTimer = null;
  }
}

function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (!target) return;

  // Allow undo/redo shortcuts to work
  if ((event.metaKey || event.ctrlKey) && (event.key === 'z' || event.key === 'y')) {
    // Don't prevent default - let the browser handle it
    return;
  }

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
  (x: number) => {
    if (x !== currentInputValue) {
      updateInputValue(x);
    }
  },
);

Vue.watch(
  () => props.min,
  newMin => {
    const newMinValue = Number(newMin);
    if (newMinValue === undefined) return;

    if (currentInputValue < newMinValue) {
      lastValueBeforeMinIncrease = Math.min(currentInputValue, lastValueBeforeMinIncrease);
      updateInputValue(newMinValue);
    } else if (currentInputValue > newMinValue && currentInputValue > lastValueBeforeMinIncrease) {
      updateInputValue(Math.max(newMinValue, lastValueBeforeMinIncrease));
    }
  },
  { immediate: true },
);

Vue.onMounted(() => {
  insertIntoInputElem(currentInputValue);
});
</script>
