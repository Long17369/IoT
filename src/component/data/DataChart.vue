<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { ColumnDef, DisplayMode } from '../../types/dataType'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const props = defineProps<{
  /** 要展示的数据（已由上层切片） */
  data: Record<string, unknown>[]
  columns: ColumnDef[]
  mode: DisplayMode
}>()

const chartColumns = computed(() => props.columns.filter((c) => c.chartable))
const stringColumns = computed(() => props.columns.filter((c) => !c.chartable))

function columnLabel(col: ColumnDef): string {
  return col.unit ? `${col.label} (${col.unit})` : col.label
}

const lineBarOption = computed(() => {
  const xData = props.data.map((_, i) => `#${i + 1}`)
  const series = chartColumns.value.map((col) => ({
    name: columnLabel(col),
    type: props.mode as 'line' | 'bar',
    data: props.data.map((d) => Number(d[col.key]) || 0),
    smooth: props.mode === 'line',
  }))

  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: xData },
    yAxis: { type: 'value' },
    series,
  }
})

const pieOption = computed(() => {
  const labelCol = stringColumns.value[0]
  const valueCol = chartColumns.value[0]
  if (!labelCol || !valueCol) return {}

  const pieData = props.data.map((d) => ({
    name: String(d[labelCol.key] ?? ''),
    value: Number(d[valueCol.key]) || 0,
  }))

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        data: pieData,
        label: { formatter: '{b}: {c}' },
      },
    ],
  }
})

const chartOption = computed(() => (props.mode === 'pie' ? pieOption.value : lineBarOption.value))
</script>

<template>
  <div class="data-chart">
    <VChart :option="chartOption" autoresize />
  </div>
</template>

<style scoped>
.data-chart {
  position: relative;
  width: 100%;
  height: 100%;
}

.data-chart :deep(> div) {
  position: absolute !important;
  inset: 0;
}
</style>
