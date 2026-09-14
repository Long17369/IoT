<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  ElSelect,
  ElOption,
  ElDatePicker,
  ElRadioGroup,
  ElRadioButton,
  ElButton,
  ElPagination,
} from 'element-plus'
import DataChart from './DataChart.vue'
import { getDataDevices, getChartData, getDataMapper } from '@/server/api'
import type { ChartPoint, FieldMapper } from '@/server/types'
import type { ColumnDef } from '@/types/dataType'

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

const rawData = ref<ChartPoint[]>([])
const fieldMappers = ref<FieldMapper[]>([])

const chartData = computed<Record<string, unknown>[]>(
  () => rawData.value as unknown as Record<string, unknown>[],
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
    rawData.value = await getChartData({
      d_no: selectedDevice.value,
      start: fmt(r.start),
      end: fmt(r.end),
      buckets: 1000,
    })
  } catch (e) {
    console.error('加载历史图表失败:', e)
    rawData.value = []
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
    </div>

    <!-- 二级视图：组合 / 单独 -->
    <ElTabs v-model="activeView" class="view-tabs">
      <ElTabPane label="组合图表" name="combined">
        <div class="chart-grid">
          <div v-for="g in combinedGroups" :key="g.key" class="chart-card">
            <div class="chart-title">{{ g.label }}</div>
            <DataChart
              :data="chartData"
              :columns="g.cols"
              mode="line"
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
              mode="line"
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
