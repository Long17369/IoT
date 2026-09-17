<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElTabs, ElTabPane, ElPagination, ElButton } from 'element-plus'
import DataTable from '../component/data/DataTable.vue'
import DataFilter from '../component/data/DataFilter.vue'
import DataChartView from '../component/data/DataChartView.vue'
import {
  getData,
  getDataMapper,
  getCount,
  getDataDevices,
  getFlowTotal,
  getRuntimeTotal,
} from '../server/api'
import { fmtDuration, fmtNum, fmtServerTime } from '../utils/format'
import type { ColumnDef } from '../types/dataType'
import type { FilterOption, FilterValue } from '../component/data/DataFilter.vue'
import type { Data, FieldMapper, Where, WhereCondition } from '@/server/types'

// 原始数据状态
const rawData = ref<Data[]>([])
const fieldMappers = ref<FieldMapper[]>([])
const totalCount = ref(0)
const loading = ref(false)

function readHashQuery(): URLSearchParams {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const queryText = rawHash.includes('?') ? rawHash.split('?')[1] : ''
  return new URLSearchParams(queryText)
}

function writeHashQuery(params: URLSearchParams) {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const path = rawHash.includes('?') ? rawHash.split('?')[0] : rawHash || '/'
  const query = params.toString()
  const nextHash = `#${path}${query ? `?${query}` : ''}`
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}${nextHash}`,
  )
}

function syncStateToUrl() {
  const params = new URLSearchParams()
  params.set('page', String(currentPage.value))
  params.set('pageSize', String(pageSize.value))
  writeHashQuery(params)
}

function restoreStateFromUrl() {
  const params = readHashQuery()

  const page = Number(params.get('page') || '1')
  const size = Number(params.get('pageSize') || '10')
  currentPage.value = Number.isFinite(page) && page > 0 ? page : 1
  pageSize.value = Number.isFinite(size) && [10, 20, 50, 100].includes(size) ? size : 10

  const where: Record<string, { value: string; operator: '=' }> = {}
  whereClause.value = where
}

// 分页配置
const pageSize = ref(10)
const currentPage = ref(1)

// 数据总览二级 Tab：数据表格 / 历史图表
const activeTab = ref<'table' | 'chart'>('table')

// 查询参数
const sortProp = ref('id')
const sortOrder = ref<'ascending' | 'descending'>('descending')

const queryParams = computed(() => ({
  limit: pageSize.value,
  offset: (currentPage.value - 1) * pageSize.value,
  order_table: sortProp.value,
  desc: sortOrder.value === 'descending',
  where: whereClause.value,
}))

// 筛选条件
const whereClause = ref<Where>({})

// 列定义（从后端字段映射动态生成）
const columns = computed<ColumnDef[]>(() => {
  const sortedMappers = fieldMappers.value
    .filter((m) => m.visible === '1')
    .sort((a, b) => a.id - b.id)

  return sortedMappers.map((m) => ({
    key: m.db_name,
    label: m.f_name,
    unit: m.unit,
    unitPlacement: 'header' as const,
    chartable: m.chartable === '1',
    sortable: true,
  }))
})

// 筛选器选项
const filterOptions = ref<FilterOption[]>([
  { key: 'd_no', label: '设备编号', type: 'select', values: [] },
  { key: 'c_time', label: '时间范围', type: 'datetimerange' },
])

// 筛选器状态
const filterValue = ref<Record<string, FilterValue>>({})

// 设备列表（汇总统计默认取第一个设备）
const devices = ref<string[]>([])

// 汇总数据：流量总计 / 水泵运行时长 / 加热运行时长
const summary = ref<{
  flowTotal: string | null
  pumpRunTime: string | null
  heatRunTime: string | null
}>({ flowTotal: null, pumpRunTime: null, heatRunTime: null })
const summaryLoading = ref(false)
const summaryDevice = ref('')
const summaryScope = ref('全部时间')

/** 运行时长展示文本（接口未就绪 / 无数据时显 --） */
const pumpRunTimeText = computed(() => fmtDuration(summary.value.pumpRunTime) || '--')
const heatRunTimeText = computed(() => fmtDuration(summary.value.heatRunTime) || '--')

/** 汇总统计的设备：筛选里选了就用它，否则用设备列表的第一个 */
function resolveSummaryDevice(filters: Record<string, FilterValue>): string {
  const picked = filters['d_no']
  if (typeof picked === 'string' && picked) return picked
  return devices.value[0] ?? ''
}

/**
 * 加载汇总数据：跟随筛选的设备 + 时间范围（未设时间范围 = 该设备全部历史）。
 * 两个接口各自独立降级：某个失败只把对应项置为 null（展示为 --），不影响另一个。
 */
async function loadSummary(filters: Record<string, FilterValue>) {
  const range = filters['c_time']
  const hasRange = Array.isArray(range)
  const start = hasRange ? (range[0] as Date).toISOString() : undefined
  const end = hasRange ? (range[1] as Date).toISOString() : undefined
  const device = resolveSummaryDevice(filters)
  summaryDevice.value = device
  summaryScope.value = hasRange ? `${fmtServerTime(start)} ~ ${fmtServerTime(end)}` : '全部时间'
  if (!device) {
    summary.value = { flowTotal: null, pumpRunTime: null, heatRunTime: null }
    return
  }
  summaryLoading.value = true
  try {
    const [flow, runtime] = await Promise.allSettled([
      getFlowTotal(device, start, end),
      getRuntimeTotal(device, start, end),
    ] as const)
    summary.value = {
      flowTotal: flow.status === 'fulfilled' ? flow.value.total : null,
      pumpRunTime: runtime.status === 'fulfilled' ? runtime.value.pump : null,
      heatRunTime: runtime.status === 'fulfilled' ? runtime.value.heat : null,
    }
    if (flow.status === 'rejected') console.warn('获取流量总计失败:', flow.reason)
    if (runtime.status === 'rejected') console.warn('获取运行时长失败:', runtime.reason)
  } finally {
    summaryLoading.value = false
  }
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [data, countResult] = await Promise.all([
      getData('sensor', queryParams.value),
      getCount('sensor', queryParams.value.where),
    ])
    rawData.value = data
    totalCount.value = countResult.count
  } finally {
    loading.value = false
  }
}

// 加载筛选选项
async function loadFilterOptions() {
  try {
    const deviceValues = await getDataDevices()
    devices.value = deviceValues
    const deviceOption = filterOptions.value.find((o) => o.key === 'd_no')
    if (deviceOption) {
      deviceOption.values = deviceValues
    }
  } catch (err) {
    console.error('加载筛选选项失败:', err)
  }
}

// 应用筛选
function applyFilters(filters: Record<string, FilterValue>) {
  const where: Where = {}
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    const opt = filterOptions.value.find((o) => o.key === key)
    // select 类型
    if (!opt?.type || opt.type === 'select') {
      where[key] = { value: String(value), operator: '=' }
    }
    // 时间范围（Date 直接进 where，经 JSON.stringify 序列化为 ISO 8601 UTC）
    if (opt?.type === 'datetimerange') {
      const [s, e] = value as [Date, Date]
      where[key] = [
        { value: s, operator: '>=' },
        { value: e, operator: '<=' },
      ]
    }
    // 数值范围
    if (opt?.type === 'range') {
      const [min, max] = value as [number, number]
      const conds: WhereCondition[] = []
      if (min !== -Infinity) conds.push({ value: String(min), operator: '>=' })
      if (max !== Infinity) conds.push({ value: String(max), operator: '<=' })
      if (conds.length) {
        where[key] = conds.length === 1 ? (conds[0] as WhereCondition) : conds
      }
    }
  }
  whereClause.value = where
  currentPage.value = 1
  syncStateToUrl()
  loadData()
  loadSummary(filters)
}

// 分页变化
function onPageChange(page: number) {
  currentPage.value = page
  syncStateToUrl()
  loadData()
}

// 每页条数变化
function onSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  syncStateToUrl()
  loadData()
}

// 排序
function onSortChange(info: { prop: string; order: 'ascending' | 'descending' | null }) {
  sortProp.value = info.prop
  sortOrder.value = info.order ?? 'descending'
  currentPage.value = 1
  loadData()
}

// 初始化
onMounted(async () => {
  restoreStateFromUrl()
  fieldMappers.value = await getDataMapper('sensor')
  await loadFilterOptions()
  await loadData()
  await loadSummary(filterValue.value)
  syncStateToUrl()
})

function identify() {
  // TODO: 识别的实现
}
</script>

<template>
  <div class="data-view">
    <ElTabs v-model="activeTab" class="data-tabs">
      <ElTabPane label="数据表格" name="table">
        <div class="data-tab-inner">
          <div class="header-section">
            <h3>传感器数据总览</h3>
            <span class="count-tip">
              共 {{ totalCount }} 条
              <span v-if="loading" class="loading-text">(加载中...)</span>
            </span>
          </div>

          <!-- 汇总数据（跟随筛选的设备与时间范围；时间范围未设 = 该设备全部历史） -->
          <div class="summary-section" v-loading="summaryLoading">
            <div class="summary-head">
              <span class="summary-title">汇总数据</span>
              <span class="summary-scope">
                设备：{{ summaryDevice || '--' }} · 范围：{{ summaryScope }}
              </span>
            </div>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">流量总计</span>
                <span class="summary-value">
                  {{ summary.flowTotal === null ? '--' : fmtNum(summary.flowTotal) }}
                  <span v-if="summary.flowTotal !== null" class="summary-unit">L</span>
                </span>
              </div>
              <div class="summary-item">
                <span class="summary-label">水泵运行时长</span>
                <span class="summary-value">{{ pumpRunTimeText }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">加热运行时长</span>
                <span class="summary-value">{{ heatRunTimeText }}</span>
              </div>
            </div>
          </div>

          <!-- 筛选器 -->
          <div class="filter-section">
            <DataFilter v-model="filterValue" :options="filterOptions" @change="applyFilters" />
            <ElButton @click="identify">识别</ElButton>
          </div>

          <!-- 表格 -->
          <div class="table-section" v-loading="loading">
            <DataTable
              :data="rawData"
              :columns="columns"
              :selectable="true"
              empty-text="离线"
              @sort-change="onSortChange"
            />
          </div>

          <!-- 分页 -->
          <div class="pagination-section">
            <ElPagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="totalCount"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @current-change="onPageChange"
              @size-change="onSizeChange"
            />
          </div>
        </div>
      </ElTabPane>
      <ElTabPane label="历史图表" name="chart" lazy>
        <DataChartView />
      </ElTabPane>
    </ElTabs>
  </div>
</template>

<style scoped>
.data-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.data-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.data-tabs :deep(.el-tabs__header) {
  flex-shrink: 0;
  margin-bottom: 8px;
}
.data-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}
.data-tabs :deep(.el-tab-pane) {
  height: 100%;
}
.data-tab-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-section h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.count-tip {
  color: #909399;
  font-size: 12px;
}

.loading-text {
  color: #409eff;
  margin-left: 8px;
}

.filter-section {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  /* flex-wrap: wrap; */
  position: relative;
  z-index: 3;
}

.summary-section {
  flex-shrink: 0;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fafcff;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.summary-scope {
  font-size: 12px;
  color: #909399;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.summary-label {
  font-size: 12px;
  color: #909399;
}

.summary-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  overflow-wrap: anywhere;
}

.summary-unit {
  font-size: 12px;
  font-weight: 400;
  color: #606266;
  margin-left: 2px;
}

.pagination-section {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.table-section {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  position: relative;
  z-index: 1;
}

.chart-section {
  flex: 1;
  min-height: 200px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  overflow: hidden;
}

/* 手机端适配 */
@media (max-width: 767px) {
  .data-view {
    gap: 8px;
    padding: 8px;
  }

  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .header-section h3 {
    font-size: 16px;
  }

  .count-tip {
    font-size: 12px;
  }

  .filter-section {
    width: 100%;
  }

  .summary-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .summary-value {
    font-size: 16px;
  }

  .table-section,
  .chart-section {
    border-radius: 4px;
    min-height: 150px;
  }

  .pagination-section {
    padding: 4px 0;
  }

  /* 分页组件移动端简化 */
  .pagination-section :deep(.el-pagination) {
    justify-content: center;
  }

  .pagination-section :deep(.el-pagination__sizes) {
    display: none;
  }

  .pagination-section :deep(.el-pagination__total) {
    font-size: 12px;
  }
}
</style>
