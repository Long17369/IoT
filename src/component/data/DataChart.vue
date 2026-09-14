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

/** 固定调色板（与 ECharts 默认一致） */
const PALETTE = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
] as const

/**
 * 根据列 key 生成稳定颜色：同一指标在任何时刻、任何位置都是同一颜色，
 * 避免实时数据更新时 series 顺序/轴位变化导致颜色跳动。
 */
function stableColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length] ?? PALETTE[0]!
}

/** 收集指定列的有效数值（跳过 invalid 置空的点） */
function collectValues(cols: ColumnDef[]): number[] {
  const vals: number[] = []
  for (const col of cols) {
    for (const d of props.data) {
      const v = seriesValue(d, col.key)
      if (v !== null) vals.push(v)
    }
  }
  return vals
}

/** 舍入到 2 位小数，消除浮点误差（如 33.190000000000001 → 33.19） */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Y 轴刻度格式化：最多保留 2 位小数，避免超长小数（包装 fmtNum 防止 ECharts 传入 index 作为 maxDigits） */
const fmtTick = (v: number | string) => fmtNum(v, 2)

/**
 * 计算 Y 轴范围：折线模式下基于数据自适应 min/max 并加 10% padding，
 * 使变化幅度小的曲线（如 26.4~27.5°C 的温度波动）能被精细观察；
 * 柱状模式保持 0 基准（返回空对象）。
 *
 * 上下限规则：
 * - 数据无负值时下界不低于 0；无正值时上界不高于 0（避免无负数据却出现负轴）；
 * - 全部同值按 ±5%（至少 ±1）展开，避免曲线贴成一条直线；
 * - 全 0 数据展开为 [0, 1]，避免产生空范围。
 */
function axisRange(cols: ColumnDef[]): { min?: number; max?: number } {
  if (props.mode === 'bar') return {}
  const vals = collectValues(cols)
  if (vals.length === 0) return {}
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (!isFinite(min) || !isFinite(max)) return {}

  const hasPositive = vals.some((v) => v > 0)
  const hasNegative = vals.some((v) => v < 0)
  const range = max - min

  let lo: number
  let hi: number
  if (range === 0) {
    // 全部同值：按数值 ±5%（至少 ±1）展开
    const pad = Math.max(Math.abs(max) * 0.05, 1)
    lo = min - pad
    hi = max + pad
  } else {
    const pad = range * 0.1
    lo = min - pad
    hi = max + pad
  }

  // 数据无负值时下界不低于 0；无正值时上界不高于 0
  if (!hasNegative) lo = Math.max(lo, 0)
  if (!hasPositive) hi = Math.min(hi, 0)

  // 全 0 数据 clamp 后会变成 [0,0]，展开为正向范围避免空轴
  if (lo === hi) hi = lo + Math.max(Math.abs(lo) * 0.05, 1)

  return { min: round2(lo), max: round2(hi) }
}

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

  // 生成单个系列的配置（固定颜色：同一指标始终同一颜色，避免实时刷新时颜色跳动）
  const mkSeries = (col: ColumnDef, yAxisIndex: number) => ({
    name: columnLabel(col),
    type: props.mode as 'line' | 'bar',
    data: props.data.map((d) => seriesValue(d, col.key)),
    smooth: props.mode === 'line',
    yAxisIndex,
    color: stableColor(col.key),
  })

  // 公共 option 骨架
  const baseOption = {
    tooltip: { trigger: 'axis', valueFormatter: fmtNumValue },
    legend: { bottom: 0 },
  }

  // 是否使用单Y轴：未开启双轴、只有 1 个指标、或所有指标同单位。
  // 同单位合并到同一轴，配合下方 Y 轴自适应上下限，能让细微波动清晰可见。
  const allSameUnit = cols.every((c) => c.unit === cols[0]?.unit)
  const useSingleAxis = !props.dualYAxis || cols.length === 1 || allSameUnit

  if (useSingleAxis) {
    return {
      ...baseOption,
      grid: { left: 60, right: 40, top: 30, bottom: 60 },
      xAxis: { type: 'category', data: xData, name: xCol?.label ?? '', axisLabel: { rotate: 30 } },
      yAxis: [
        {
          type: 'value',
          name: cols[0]?.unit || '',
          axisLabel: { formatter: fmtTick },
          ...axisRange(cols),
        },
      ],
      series: cols.map((col) => mkSeries(col, 0)),
    }
  }

  // 双Y轴：按列定义顺序稳定分组（前一半左轴、后一半右轴），
  // 不再按动态平均值排序，避免实时数据更新导致指标在左右轴之间跳动、颜色错乱
  const midIndex = Math.ceil(cols.length / 2)
  const leftCols = cols.slice(0, midIndex)
  const rightCols = cols.slice(midIndex)

  const series: Record<string, unknown>[] = [
    ...leftCols.map((col) => mkSeries(col, 0)),
    ...rightCols.map((col) => mkSeries(col, 1)),
  ]

  const yAxis: Record<string, unknown>[] = [
    {
      type: 'value',
      name: leftCols[0] ? columnLabel(leftCols[0]) : '',
      position: 'left',
      axisLine: { show: true, lineStyle: { color: '#5470c6' } },
      axisLabel: { color: '#5470c6', formatter: fmtTick },
      ...axisRange(leftCols),
    },
  ]
  if (rightCols.length > 0) {
    yAxis.push({
      type: 'value',
      name: columnLabel(rightCols[0]!),
      position: 'right',
      axisLine: { show: true, lineStyle: { color: '#91cc75' } },
      axisLabel: { color: '#91cc75', formatter: fmtTick },
      ...axisRange(rightCols),
    })
  }

  return {
    ...baseOption,
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
