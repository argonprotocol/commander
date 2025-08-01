<!-- prettier-ignore -->
<template>
  <div Wrapper class="grow h-full flex flex-col relative w-full">
    <div class="absolute w-full h-full">
      <slot />
      <!-- <Charttip :config="tooltipConfig" /> -->
    </div>

    <div ChartWrapper class="grow relative w-full">
      <canvas id="MyChart" ref="chartRef"></canvas>
    </div>

    <div
      v-if="markerPos.show"
      StartMarker
      class="MARKER cursor-pointer"
      :style="`left: ${markerPos.left}px; top: ${markerPos.top}px`"
    ></div>
    <XAxis class="relative mb-4 z-10" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs, { Dayjs } from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  TimeScale,
  Tooltip,
  TooltipModel,
} from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
// import Charttip from '../overlays/Charttip.vue';
import { createChartOptions } from '../lib/ChartOptions';
import XAxis from './XAxis.vue';

dayjs.extend(dayjsUtc);
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, TimeScale, Tooltip);

const props = defineProps<{
  isRunning?: boolean;
  disableTooltip?: boolean;
}>();

const totalDays = dayjs('2025-12-31').diff(dayjs('2020-10-01'), 'day');
const loadPct = Vue.ref(0);

const markerPos = Vue.ref({ show: false, left: 0, top: 0 });

const chartRef = Vue.ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

const chartPoints: any[] = [];
const pointRadius: number[] = [];
const pointItems: any[] = [];
const pointItemsByDate: Record<string, any> = {};

const tooltipConfig = Vue.ref({
  opacity: 0,
  class: '',
  left: 0,
  top: 0,
  item: {} as any,
});

function toggleDatasetVisibility(index: number, visible: boolean) {
  const dataset = chart?.data.datasets[index];
  if (dataset) {
    dataset.hidden = !visible;
  }
  chart?.update();
}

function clearPoints() {
  chartPoints.splice(0, chartPoints.length);
  pointRadius.splice(0, pointRadius.length);
  pointItems.splice(0, pointItems.length);
  chart?.update();
}

function setDateRange(min: string, max: string) {
  if (!chart) return;
  (chart as any).options.scales.x.min = dayjs.utc(min).valueOf();
  (chart as any).options.scales.x.max = dayjs.utc(max).valueOf();
  chart.update();
}

function addPoints(items: { date: string; price: number; showPointOnChart: boolean }[]) {
  const lastIndex = chartPoints.length - 1;
  if (lastIndex > 0) {
    pointRadius[lastIndex] = chartPoints[lastIndex].showPointOnChart ? 4 : 0;
  }

  for (const item of items) {
    const date = dayjs.utc(item.date);
    const price = item.price;

    chartPoints.push({ x: date.valueOf(), y: price });
    pointRadius.push(item.showPointOnChart ? 4 : 0);
    pointItems.push(item);
    pointItemsByDate[item.date] = item;
  }

  pointRadius[pointRadius.length - 1] = 4;

  pointRadius[0] = 4;
  const daysLoaded = chartPoints.length / totalDays;
  loadPct.value = Math.round(daysLoaded * 100);

  if (!chart) return;
  chart.update();

  const dataset = chart.data.datasets[0];
  const datasetData = dataset.data;
  const currentIndex = datasetData.length - 1;

  const meta = chart?.getDatasetMeta(0);
  const currentDataPoint = meta?.data[currentIndex];

  markerPos.value.left = currentDataPoint?.x || 0;
  markerPos.value.top = currentDataPoint?.y || 0;

  // Trigger tooltip on the latest point
  if (props.isRunning && currentDataPoint && pointItems.length > 10) {
    chart?.tooltip?.setActiveElements([{ datasetIndex: 0, index: currentIndex }], {
      x: currentDataPoint.x,
      y: currentDataPoint.y,
    });
    chart?.update();
  }

  return { x: currentDataPoint?.x, y: currentDataPoint?.y };
}

const tooltipOpened = Vue.ref(false);

function reloadData(items: any[]) {
  if (!chart) return;

  chartPoints.splice(0, chartPoints.length);
  pointRadius.splice(0, pointRadius.length);
  pointItems.splice(0, pointItems.length);

  addPoints(items);
}

function getPointPosition(index: number) {
  const meta = chart?.getDatasetMeta(0);
  const currentDataPoint = meta?.data[index];

  return { x: currentDataPoint?.x, y: currentDataPoint?.y };
}

function getItem(index: number) {
  index = Math.max(0, index);
  index = Math.min(pointItems.length - 1, index);
  return pointItems[index];
}

function getItems(startIndex: number, endIndex: number) {
  return pointItems.slice(startIndex, endIndex);
}

function getItemCount() {
  return pointItems.length;
}

function getItemIndexFromDate(date: string | Dayjs) {
  if (dayjs.isDayjs(date)) {
    date = date.format('YYYY-MM-DD');
  }
  return pointItemsByDate[date] ? pointItems.indexOf(pointItemsByDate[date]) : -1;
}

function getItemIndexFromEvent(event: MouseEvent, override: { x?: number; y?: number } = {}) {
  if (!chartRef.value) return;

  const rect = chartRef.value.getBoundingClientRect();
  const maxY = rect.height - rect.top;
  const eventX = override.x || event.x;
  const eventY = override.y || event.y;

  const wrappedEvent = {
    chart: chart,
    native: event,
    offsetX: undefined,
    offsetY: undefined,
    type: event.type,
    x: eventX,
    y: Math.min(eventY, maxY),
  };
  const interactionItems =
    chart?.getElementsAtEventForMode(wrappedEvent as any, 'index', { intersect: false }, true) || [];
  return interactionItems[0]?.index;
}

function getPrevMonthIndex(index: number) {
  const currentDate = dayjs.utc(pointItems[index].date);
  const dayOfMonth = currentDate.date();
  const previousDate = dayOfMonth === 1 ? currentDate.subtract(1, 'month') : currentDate.startOf('month');
  const daysToSubtract = currentDate.diff(previousDate, 'day');
  return index - daysToSubtract;
}

function getNextMonthIndex(index: number) {
  const currentDate = dayjs.utc(pointItems[index].date);
  const nextDate = currentDate.add(1, 'month').startOf('month');
  const daysToAdd = nextDate.diff(currentDate, 'day');
  console.log(currentDate.toISOString(), nextDate.toISOString(), daysToAdd);
  return index + daysToAdd;
}

function onTooltipFn(tooltip: TooltipModel<any>, closeIfItemMatchesThis?: any) {
  if (tooltipOpened.value) return;
  // Hide if no tooltip
  if (tooltip.opacity === 0 || !tooltip.dataPoints || props.disableTooltip) {
    tooltipConfig.value.opacity = 0;
    return;
  }

  const pointIndex = tooltip.dataPoints[0].dataIndex;
  const item = pointItems[pointIndex];

  if (closeIfItemMatchesThis === item) {
    tooltipConfig.value.opacity = 0;
    return;
  }

  tooltipConfig.value.item = item;

  // Set caret Position
  if (tooltip.yAlign) {
    tooltipConfig.value.class = tooltip.yAlign; // above or below
  } else {
    tooltipConfig.value.class = 'no-transform';
  }

  tooltipConfig.value.opacity = 1;
  tooltipConfig.value.left = tooltip.caretX;
  tooltipConfig.value.top = tooltip.caretY;
}

function startPulsing() {
  markerPos.value.show = true;
}

function stopPulsing() {
  markerPos.value.show = false;
}

Vue.onMounted(() => {
  if (chartRef.value) {
    const chartOptions = createChartOptions(chartPoints, pointRadius, onTooltipFn);
    chart = new Chart(chartRef.value, chartOptions as any);
  }
});

Vue.onBeforeUnmount(() => {
  if (chart) {
    chart.destroy();
  }
});

defineExpose({
  getPrevMonthIndex,
  getNextMonthIndex,
  getItems,
  getItem,
  getItemIndexFromEvent,
  getItemCount,
  getItemIndexFromDate,
  addPoints,
  reloadData,
  startPulsing,
  stopPulsing,
  clearPoints,
  toggleDatasetVisibility,
  setDateRange,
  getPointPosition,
});
</script>

<style lang="scss" scoped>
.MARKER {
  @apply rounded-full bg-[#63298E] absolute z-20 border border-slate-400;
  width: 10px;
  height: 10px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

[ShadowSelection] {
  box-shadow:
    1px 1px 1px 0 rgb(0 0 0),
    inset 1px 1px 1px 0 rgb(0 0 0);
}

.MARKER {
  pointer-events: none;

  &:before,
  &:after {
    content: '';
    display: block;
    position: absolute;
    border: 2px solid #63298e;
    left: -20px;
    right: -20px;
    top: -20px;
    bottom: -20px;
    border-radius: 50%;
    animation: animate 1.5s linear infinite;
    backface-visibility: hidden;
  }

  &:after {
    animation-delay: 0.5s;
  }
}

@keyframes animate {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}
</style>
