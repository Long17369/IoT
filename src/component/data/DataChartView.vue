<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  ElSelect,
  ElOption,
  ElDatePicker,
  ElRadioGroup,
  ElRadioButton,
  ElCheckbox,
  ElButton,
  ElPagination,
} from 'element-plus'
import DataChart from './DataChart.vue'
import { getDataDevices, getChartData, getDataMapper } from '@/server/api'
import type { ChartPoint, FieldMapper } from '@/server/types'
import type { ColumnDef, DisplayMode } from '@/types/dataType'

// 快捷时间范围（分钟）
const QUICK_RANGES = [
  { label: '10分钟', minutes: 10 },
  { label: '30分钟', minutes: 30 },
  { label: '1小时', minutes: 60 },
  { label: '3小时', minutes: 180 },
  { label: '6小时', minutes: 360 },
  { label: '12小时', minutes: 720 },
  { label: '24小时', minutes: 1440 },
]
const CUSTOM = -1

// 拉取的时间桶数（= 期望点数）：一次取密，折线图直接用它
const FETCH_BUCKETS = 1000
// 柱状图的目标柱数：受图宽限制，由前端在已取到的数据上聚合（双序列图柱子成对并排，按“序列数×柱数”估算宽度）
const BAR_BUCKETS = 60

// 组合图表：3 张表（温度1+2、累计流量、瞬时流量+压力）
const COMBINED_GROUPS = [
  { key: 'temp', label: '温度曲线', cols: ['field1', 'field2'], dualY: true },
  { key: 'flow_total', label: '累计流量', cols: ['field5'], dualY: false },
  {
    key: 'flow_instant_pressure',
    label: '瞬时流量与压力',
    cols: ['field6', 'field7'],
    dualY: true,
  },
]
// 单数据图表：5 张全部分开（加热/水泵不做）
const SOLO_KEYS = ['field1', 'field2', 'field5', 'field6', 'field7']

const devices = ref<string[]>([])
const selectedDevice = ref('')
const activeRange = ref(10) // 分钟；-1 = 自定义
const customRange = ref<[Date, Date] | null>(null)
const loading = ref(false)
const activeView = ref<'combined' | 'solo'>('combined')
/** 图表类型：折线 / 柱状（组合图表与单数据图表共用） */
const chartMode = ref<DisplayMode>('line')

/** 实时模式：勾选后按固定间隔重新取数（时间窗随“当前时间”滑动，图表自动走到最新） */
const realtime = ref(false)
const REALTIME_INTERVAL = 5000
let realtimeTimer: ReturnType<typeof setInterval> | null = null

function stopRealtime() {
  if (realtimeTimer) {
    clearInterval(realtimeTimer)
    realtimeTimer = null
  }
}

function startRealtime() {
  stopRealtime()
  realtimeTimer = setInterval(() => {
    // 上一次请求还没回来就跳过本轮，避免请求堆积
    if (!loading.value) load()
  }, REALTIME_INTERVAL)
}

const rawData = ref<ChartPoint[]>([])
// 已取数据对应的时间窗口（柱状图聚合需要按等长时间分桶）
const loadedWindow = ref<{ start: Date; end: Date } | null>(null)
const fieldMappers = ref<FieldMapper[]>([])

/** 解析后端时间字符串（'YYYY-MM-DD HH:mm:ss'，按本地时间解析） */
function parseTime(value: unknown): number {
  const t = new Date(String(value ?? '').replace(' ', 'T')).getTime()
  return Number.isFinite(t) ? t : NaN
}

/** 时间桶长度(ms)：与后端一致（总时长/桶数，向上取整到秒，最小 1s） */
function bucketStep(window: { start: Date; end: Date }, buckets: number): number {
  const span = Math.max(1, window.end.getTime() - window.start.getTime())
  return Math.max(1000, Math.ceil(span / buckets / 1000) * 1000)
}

/**
 * 后端 /chart 只返回「有数据的桶」，缺数据的时间段会在图上直接消失（横轴被压缩、
 * 曲线还会跨过缺口连起来）。这里按请求的桶数把缺失的时间桶补成 null 行：
 * 折线在缺数据处断成缺口，横轴保持完整时间跨度。
 */
function padMissingBuckets(
  rows: ChartPoint[],
  window: { start: Date; end: Date },
  buckets: number,
): ChartPoint[] {
  if (rows.length === 0) return []
  const startMs = window.start.getTime()
  const step = bucketStep(window, buckets)
  const keys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) if (key !== 'c_time') keys.add(key)
  }
  const filled: ChartPoint[] = Array.from({ length: buckets }, (_, idx) => {
    const row: ChartPoint = { c_time: fmt(new Date(startMs + idx * step)) }
    for (const key of keys) row[key] = null
    return row
  })
  for (const row of rows) {
    const t = parseTime(row.c_time)
    if (!Number.isFinite(t)) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - startMs) / step)))
    filled[idx] = row
  }
  return filled
}

/**
 * 把折线数据按等长时间桶聚合成柱状图数据（各列取桶内 AVG，空桶为 null，
 * c_time 取桶内最大时间）：在本地已取到的数据上算，切换图表类型不用重新请求，
 * 也就不会出现“先用旧数据按新形态渲染一次、数据回来再突变”的顿挫。
 */
function aggregateToBuckets(
  points: ChartPoint[],
  window: { start: Date; end: Date },
  buckets: number,
): ChartPoint[] {
  if (points.length === 0) return []
  const startMs = window.start.getTime()
  const step = bucketStep(window, buckets)
  const columns = Object.keys(points[0] ?? {}).filter((key) => key !== 'c_time')

  const sums = new Map<number, number[]>()
  const counts = new Map<number, number[]>()
  const labels = new Map<number, string>()

  for (const point of points) {
    const t = parseTime(point.c_time)
    if (!Number.isFinite(t)) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((t - startMs) / step)))
    const bucketSums = sums.get(idx) ?? Array.from({ length: columns.length }, () => 0)
    const bucketCounts = counts.get(idx) ?? Array.from({ length: columns.length }, () => 0)
    columns.forEach((key, i) => {
      const raw = point[key]
      if (raw === null || raw === undefined || raw === '') return
      const num = Number(raw)
      if (!Number.isFinite(num)) return
      bucketSums[i] = (bucketSums[i] ?? 0) + num
      bucketCounts[i] = (bucketCounts[i] ?? 0) + 1
    })
    sums.set(idx, bucketSums)
    counts.set(idx, bucketCounts)
    // 与后端一致：桶标签取桶内最大时间
    const prev = labels.get(idx)
    if (!prev || t > parseTime(prev)) labels.set(idx, String(point.c_time))
  }

  const rows: ChartPoint[] = []
  for (let idx = 0; idx < buckets; idx++) {
    const bucketSums = sums.get(idx)
    const bucketCounts = counts.get(idx)
    const row: ChartPoint = {
      c_time: labels.get(idx) ?? fmt(new Date(startMs + idx * step)),
    }
    columns.forEach((key, i) => {
      const count = bucketCounts?.[i] ?? 0
      row[key] = count > 0 ? (bucketSums?.[i] ?? 0) / count : null
    })
    rows.push(row)
  }
  return rows
}

/** 柱状图数据（由已取数据本地聚合，切换类型时不会先闪一下旧数据） */
const barData = computed<ChartPoint[]>(() => {
  if (!loadedWindow.value) return []
  return aggregateToBuckets(rawData.value, loadedWindow.value, BAR_BUCKETS)
})

const chartData = computed<Record<string, unknown>[]>(
  () =>
    (chartMode.value === 'bar' ? barData.value : rawData.value) as unknown as Record<
      string,
      unknown
    >[],
)

const allColumns = computed<ColumnDef[]>(() => {
  const sorted = fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id)
  return sorted.map((m) => ({
    key: m.db_name,
    label: m.f_name,
    unit: m.unit || undefined,
    chartable: m.chartable === '1',
  }))
})

const colMap = computed(() => {
  const map = new Map<string, ColumnDef>()
  for (const c of allColumns.value) map.set(c.key, c)
  return map
})

/** 组装某图表的列：始终带 c_time（X 轴）+ 指定字段 */
function buildColumns(keys: string[]): ColumnDef[] {
  const timeCol = colMap.value.get('c_time') ?? {
    key: 'c_time',
    label: '时间',
    chartable: false,
  }
  const cols: ColumnDef[] = [timeCol]
  for (const k of keys) {
    const c = colMap.value.get(k)
    if (c) cols.push({ ...c, chartable: true })
  }
  return cols
}

// 组合 3 张表
const combinedGroups = computed(() =>
  COMBINED_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    cols: buildColumns(g.cols),
    dualY: g.dualY,
  })),
)

// 单独 5 张表
const soloGroups = computed(() =>
  SOLO_KEYS.map((k) => ({
    key: k,
    label: colMap.value.get(k)?.label ?? k,
    cols: buildColumns([k]),
  })),
)

// 单数据图表每页一张（分页）
const currentSoloPage = ref(1)
const currentSoloGroup = computed(() => soloGroups.value[currentSoloPage.value - 1])

onMounted(async () => {
  try {
    fieldMappers.value = await getDataMapper('sensor')
  } catch (e) {
    console.error('获取字段映射失败:', e)
  }
  try {
    devices.value = await getDataDevices()
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0] ?? ''
      await load()
    }
  } catch (e) {
    console.error('获取设备列表失败:', e)
  }
})

/**
 * 计算查询时间窗口：快捷范围取"当前时间往前推 activeRange 分钟"。
 * 用普通函数而非 computed——computed 会缓存 new Date()，点"刷新"时窗口不会滑到最新，导致数据不更新。
 */
function getRange(): { start: Date; end: Date } {
  const end = new Date()
  if (activeRange.value === CUSTOM && customRange.value) {
    return { start: customRange.value[0], end: customRange.value[1] }
  }
  const start = new Date(end.getTime() - activeRange.value * 60 * 1000)
  return { start, end }
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

async function load() {
  if (!selectedDevice.value) return
  loading.value = true
  try {
    const r = getRange()
    const rows = await getChartData({
      d_no: selectedDevice.value,
      start: fmt(r.start),
      end: fmt(r.end),
      buckets: FETCH_BUCKETS,
    })
    // 后端只返回有数据的桶，先补齐空桶再上屏/聚合
    rawData.value = padMissingBuckets(rows, r, FETCH_BUCKETS)
    loadedWindow.value = r
  } catch (e) {
    console.error('加载历史图表失败:', e)
    rawData.value = []
    loadedWindow.value = null
  } finally {
    loading.value = false
  }
}

function selectQuick(val: string | number | boolean | undefined) {
  const minutes = Number(val)
  if (!isNaN(minutes)) {
    activeRange.value = minutes
    load()
  }
}

function applyCustom() {
  if (customRange.value && customRange.value[0] && customRange.value[1]) {
    activeRange.value = CUSTOM
    load()
  }
}

watch(selectedDevice, () => load())

// 实时模式：勾选后立即取一次，然后定时刷新（时间窗随当前时间滑动）
watch(realtime, (on) => {
  if (on) {
    load()
    startRealtime()
  } else {
    stopRealtime()
  }
})

onBeforeUnmount(stopRealtime)
</script>

<template>
  <div class="history-charts">
    <!-- 工具栏：设备 + 时间范围 -->
    <div class="chart-toolbar">
      <span class="toolbar-label">设备：</span>
      <ElSelect v-model="selectedDevice" size="default" style="width: 200px" placeholder="选择设备">
        <ElOption v-for="d in devices" :key="d" :label="d" :value="d" />
      </ElSelect>
      <span class="toolbar-label">时间范围：</span>
      <ElRadioGroup :model-value="activeRange" size="default" @update:model-value="selectQuick">
        <ElRadioButton v-for="q in QUICK_RANGES" :key="q.minutes" :value="q.minutes">
          {{ q.label }}
        </ElRadioButton>
        <ElRadioButton :value="CUSTOM">自定义</ElRadioButton>
      </ElRadioGroup>
      <ElDatePicker
        v-if="activeRange === CUSTOM"
        v-model="customRange"
        type="datetimerange"
        size="default"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        :clearable="false"
        @change="applyCustom"
      />
      <ElButton :loading="loading" @click="load">刷新</ElButton>
      <ElCheckbox v-model="realtime">实时</ElCheckbox>
    </div>

    <!-- 二级视图：组合 / 单独（右上角切换图表类型） -->
    <div class="view-tabs-wrap">
      <ElTabs v-model="activeView" class="view-tabs">
        <ElTabPane label="组合图表" name="combined">
          <div class="chart-grid">
            <div v-for="g in combinedGroups" :key="g.key" class="chart-card">
              <div class="chart-title">{{ g.label }}</div>
              <DataChart
                :data="chartData"
                :columns="g.cols"
                :mode="chartMode"
                x-axis-key="c_time"
                :dual-y-axis="g.dualY"
                x-time-format="full"
              />
            </div>
          </div>
        </ElTabPane>
        <ElTabPane label="单数据图表" name="solo" lazy>
          <div class="solo-page">
            <div v-if="currentSoloGroup" class="solo-chart">
              <div class="chart-title">{{ currentSoloGroup.label }}</div>
              <DataChart
                :data="chartData"
                :columns="currentSoloGroup.cols"
                :mode="chartMode"
                x-axis-key="c_time"
                :dual-y-axis="false"
                x-time-format="full"
              />
            </div>
            <div v-else class="empty-tip">暂无数据</div>
            <ElPagination
              v-model:current-page="currentSoloPage"
              :total="soloGroups.length"
              :page-size="1"
              layout="prev, pager, next, jumper"
              hide-on-single-page
            />
          </div>
        </ElTabPane>
      </ElTabs>
      <!-- 图表类型：贴在二级页签行的最右侧 -->
      <div class="chart-mode-select">
        <span class="toolbar-label">图表类型：</span>
        <ElSelect v-model="chartMode" size="small" style="width: 110px">
          <ElOption label="折线图" value="line" />
          <ElOption label="柱状图" value="bar" />
        </ElSelect>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-charts {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.chart-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-label {
  font-size: 13px;
  color: #606266;
}

.view-tabs-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 图表类型下拉：浮在二级页签行右侧（页签行高 40px，small 控件高 24px → top 8px） */
.chart-mode-select {
  position: absolute;
  top: 8px;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
}

.view-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.view-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 4px;
}

.chart-card {
  min-width: 0; /* 防止 grid item 被 canvas 撑开导致宽度振荡 */
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  min-height: 300px;
}

.chart-title {
  font-size: 13px;
  color: #303133;
  font-weight: 600;
  margin-bottom: 6px;
}

.chart-card :deep(.data-chart) {
  height: 260px;
  overflow: hidden;
}

.solo-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.solo-chart {
  flex: 1;
  min-height: 0;
  min-width: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.solo-chart :deep(.data-chart) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.empty-tip {
  color: #909399;
  padding: 40px;
  text-align: center;
}

@media (max-width: 900px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
