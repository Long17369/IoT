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
import { fmtNum } from '@/utils/format'
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
  /** X轴字段名，默认使用第一个非chartable的列 */
  xAxisKey?: string
  /** 是否使用双Y轴，默认false */
  dualYAxis?: boolean
  /** X轴时间格式：'ms'=MM:SS（默认）；'full'=按跨度自适应完整时间 */
  xTimeFormat?: 'ms' | 'full'
}>()

const chartColumns = computed(() => props.columns.filter((c) => c.chartable))
const stringColumns = computed(() => props.columns.filter((c) => !c.chartable))

function columnLabel(col: ColumnDef): string {
  return col.unit ? `${col.label} (${col.unit})` : col.label
}

/** ECharts tooltip 值格式化：超 2 位小数截断 */
const fmtNumValue = (value: number | string) => fmtNum(value)

/** 无效点（跳变标注 invalid）置 null，使曲线在此断开 */
const seriesValue = (d: Record<string, unknown>, key: string): number | null =>
  d.invalid ? null : Number(d[key]) || 0

const lineBarOption = computed(() => {
  // 确定X轴字段
  const xColKey = props.xAxisKey || stringColumns.value[0]?.key
  const xCol = props.columns.find((c) => c.key === xColKey)

  // 计算时间跨度（xTimeFormat='full' 时按跨度自适应显示）
  const rawTimes = props.data
    .map((d) => new Date(String(d[xColKey ?? 'c_time'] ?? '').replace(' ', 'T')).getTime())
    .filter((t) => !isNaN(t))
  const spanMs = rawTimes.length > 1 ? Math.max(...rawTimes) - Math.min(...rawTimes) : 0

  // 格式化时间：默认 MM:SS；xTimeFormat='full' 时短范围 HH:MM:SS、长范围 MM-DD HH:MM
  const formatTime = (val: unknown): string => {
    const s = String(val ?? '')
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s)) {
      const d = new Date(s.replace(' ', 'T'))
      if (!isNaN(d.getTime())) {
        if (props.xTimeFormat !== 'full') {
          const minutes = String(d.getMinutes()).padStart(2, '0')
          const seconds = String(d.getSeconds()).padStart(2, '0')
          return `${minutes}:${seconds}`
        }
        if (spanMs > 0 && spanMs <= 3600_000) {
          const hh = String(d.getHours()).padStart(2, '0')
          const mm = String(d.getMinutes()).padStart(2, '0')
          const ss = String(d.getSeconds()).padStart(2, '0')
          return `${hh}:${mm}:${ss}`
        }
        const mo = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return `${mo}-${day} ${hh}:${mm}`
      }
    }
    return s
  }

  const xData = xCol
    ? props.data.map((d) => formatTime(d[xCol.key]))
    : props.data.map((_, i) => `#${i + 1}`)

  const cols = chartColumns.value
  const hasData = cols.length > 0 && props.data.length > 0

  // 没有可图表化的列或没有数据时，返回空图表占位
  if (!hasData) {
    return {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#999', fontSize: 14 },
      },
      xAxis: { type: 'category', data: [] },
      yAxis: [{ type: 'value' }],
      series: [],
    }
  }

  // 不使用双Y轴，所有数据使用同一个Y轴
  if (!props.dualYAxis) {
    const series = cols.map((col) => ({
      name: columnLabel(col),
      type: props.mode as 'line' | 'bar',
      data: props.data.map((d) => seriesValue(d, col.key)),
      smooth: props.mode === 'line',
      yAxisIndex: 0,
    }))

    return {
      tooltip: { trigger: 'axis', valueFormatter: fmtNumValue },
      legend: { bottom: 0 },
      grid: { left: 60, right: 40, top: 30, bottom: 60 },
      xAxis: { type: 'category', data: xData, name: xCol?.label ?? '', axisLabel: { rotate: 30 } },
      yAxis: [{ type: 'value', name: cols[0]?.unit || '' }],
      series,
    }
  }

  // 使用双Y轴：将指标分成两组，小数值在左侧，大数值在右侧
  if (cols.length === 1) {
    // 只有一个指标时，使用单Y轴
    const firstCol = cols[0]!
    return {
      tooltip: { trigger: 'axis', valueFormatter: fmtNumValue },
      legend: { bottom: 0 },
      grid: { left: 60, right: 40, top: 30, bottom: 60 },
      xAxis: { type: 'category', data: xData, name: xCol?.label ?? '', axisLabel: { rotate: 30 } },
      yAxis: [{ type: 'value', name: firstCol.unit || '' }],
      series: [
        {
          name: columnLabel(firstCol),
          type: props.mode as 'line' | 'bar',
          data: props.data.map((d) => seriesValue(d, firstCol.key)),
          smooth: props.mode === 'line',
          yAxisIndex: 0,
        },
      ],
    }
  }

  // 计算每个指标的数据范围（最大值-最小值），用于判断是否需要双Y轴
  const colStats = cols.map((col) => {
    const values = props.data.map((d) => Number(d[col.key]) || 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    return { col, min, max, avg, range: max - min }
  })

  // 按平均值排序
  colStats.sort((a, b) => a.avg - b.avg)

  // 检查是否需要双Y轴
  const allSameUnit = cols.every((c) => c.unit === cols[0]?.unit)

  // 同单位但数值范围差异大（如温差2°C vs 温度25°C），需要双Y轴分开显示
  if (allSameUnit && colStats.length >= 2) {
    const maxAvg = Math.max(...colStats.map((s) => s.avg))
    // 如果某个指标的平均值不到最大平均值的 20%，说明量级差异大，需要双Y轴
    const smallCols = colStats.filter((s) => s.avg < maxAvg * 0.2).map((s) => s.col)
    const normalCols = colStats.filter((s) => s.avg >= maxAvg * 0.2).map((s) => s.col)

    if (smallCols.length > 0 && normalCols.length > 0) {
      // 量级差异大：正常值在左轴，小值在右轴
      const series: Record<string, unknown>[] = []
      const yAxis: Record<string, unknown>[] = [
        {
          type: 'value',
          name: normalCols[0] ? columnLabel(normalCols[0]) : '',
          position: 'left',
          axisLine: { show: true, lineStyle: { color: '#5470c6' } },
          axisLabel: { color: '#5470c6' },
        },
        {
          type: 'value',
          name: smallCols[0] ? columnLabel(smallCols[0]) : '',
          position: 'right',
          axisLine: { show: true, lineStyle: { color: '#91cc75' } },
          axisLabel: { color: '#91cc75' },
        },
      ]

      normalCols.forEach((col) => {
        series.push({
          name: columnLabel(col),
          type: props.mode as 'line' | 'bar',
          data: props.data.map((d) => seriesValue(d, col.key)),
          smooth: props.mode === 'line',
          yAxisIndex: 0,
        })
      })
      smallCols.forEach((col) => {
        series.push({
          name: columnLabel(col),
          type: props.mode as 'line' | 'bar',
          data: props.data.map((d) => seriesValue(d, col.key)),
          smooth: props.mode === 'line',
          yAxisIndex: 1,
        })
      })

      return {
        tooltip: { trigger: 'axis', valueFormatter: fmtNumValue },
        legend: { bottom: 0 },
        grid: { left: 60, right: 60, top: 30, bottom: 60 },
        xAxis: {
          type: 'category',
          data: xData,
          name: xCol?.label ?? '',
          axisLabel: { rotate: 30 },
        },
        yAxis,
        series,
      }
    }
  }

  // 同一单位且量级接近，使用单Y轴
  if (allSameUnit) {
    const series = cols.map((col) => ({
      name: columnLabel(col),
      type: props.mode as 'line' | 'bar',
      data: props.data.map((d) => seriesValue(d, col.key)),
      smooth: props.mode === 'line',
      yAxisIndex: 0,
    }))

    return {
      tooltip: { trigger: 'axis', valueFormatter: fmtNumValue },
      legend: { bottom: 0 },
      grid: { left: 60, right: 40, top: 30, bottom: 60 },
      xAxis: { type: 'category', data: xData, name: xCol?.label ?? '', axisLabel: { rotate: 30 } },
      yAxis: [{ type: 'value', name: cols[0]?.unit || '' }],
      series,
    }
  }

  // 需要双Y轴：按平均值分组
  const midIndex = Math.max(1, Math.ceil(colStats.length / 2))
  const leftCols = colStats.slice(0, midIndex).map((s) => s.col)
  const rightCols = colStats.slice(midIndex).map((s) => s.col)

  const series: Record<string, unknown>[] = []
  const yAxis: Record<string, unknown>[] = []

  // 左侧Y轴
  yAxis.push({
    type: 'value',
    name: leftCols.length > 0 ? columnLabel(leftCols[0]!) : '',
    position: 'left',
    axisLine: { show: true, lineStyle: { color: '#5470c6' } },
    axisLabel: { color: '#5470c6' },
  })

  leftCols.forEach((col) => {
    series.push({
      name: columnLabel(col),
      type: props.mode as 'line' | 'bar',
      data: props.data.map((d) => seriesValue(d, col.key)),
      smooth: props.mode === 'line',
      yAxisIndex: 0,
    })
  })

  // 右侧Y轴（仅在有右侧指标时添加）
  if (rightCols.length > 0) {
    yAxis.push({
      type: 'value',
      name: columnLabel(rightCols[0]!),
      position: 'right',
      axisLine: { show: true, lineStyle: { color: '#91cc75' } },
      axisLabel: { color: '#91cc75' },
    })
    rightCols.forEach((col) => {
      series.push({
        name: columnLabel(col),
        type: props.mode as 'line' | 'bar',
        data: props.data.map((d) => seriesValue(d, col.key)),
        smooth: props.mode === 'line',
        yAxisIndex: 1,
      })
    })
  }

  return {
    tooltip: { trigger: 'axis', valueFormatter: fmtNumValue },
    legend: { bottom: 0 },
    grid: { left: 60, right: 60, top: 30, bottom: 60 },
    xAxis: { type: 'category', data: xData, name: xCol?.label ?? '', axisLabel: { rotate: 30 } },
    yAxis,
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
    <VChart :option="chartOption" autoresize :update-options="{ notMerge: true }" />
  </div>
</template>

<style scoped>
.data-chart {
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.data-chart :deep(.vue-echarts) {
  width: 100% !important;
  height: 100% !important;
}
</style>
