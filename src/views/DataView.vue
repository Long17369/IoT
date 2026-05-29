<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElPagination, ElTabs, ElTabPane } from 'element-plus'
import DataTable from '../component/data/DataTable.vue'
import DataFilter from '../component/data/DataFilter.vue'
import { getData, getDataMapper, getCount, getDevice } from '../server/api'
import type { ColumnDef } from '../types/dataType'
import type { FilterOption, FilterValue } from '../component/data/DataFilter.vue'
import type { Data, FieldMapper } from '../types/api'

// 当前选中的数据类型 tab
const activeTable = ref<'temp' | 'humi' | 'light'>('temp')

// 原始数据状态
const rawData = ref<Data[]>([])
const fieldMappers = ref<FieldMapper[]>([])
const totalCount = ref(0)
const loading = ref(false)

// 移动端检测
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)

// 监听窗口大小变化
onMounted(() => {
  window.addEventListener('resize', () => {
    windowWidth.value = window.innerWidth
  })
})

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
const whereClause = ref<Record<string, { value: string; operator: '=' | '>' | '<' | '>=' | '<=' }>>(
  {},
)

// 列定义（从后端字段映射动态生成）
const columns = computed<ColumnDef[]>(() => {
  const baseColumns: ColumnDef[] = [
    { key: 'id', label: 'ID', chartable: false, sortable: true },
    { key: 'd_no', label: '设备编号', chartable: false, sortable: true },
    { key: 'c_time', label: '创建时间', chartable: false, sortable: true },
    { key: 'online', label: '数据类型', chartable: false, sortable: true },
  ]

  const sortedMappers = fieldMappers.value
    .filter((m) => m.visible === '1')
    .sort((a, b) => a.id - b.id)

  const mapperColumns = sortedMappers.map((m) => ({
    key: m.db_name,
    label: m.f_name,
    unit: m.unit,
    unitPlacement: 'header' as const,
    chartable: m.type === '1',
    sortable: true,
  }))

  return [...baseColumns, ...mapperColumns]
})

// 所有可能的筛选选项（从所有数据中获取，不是筛选后的）
const allDevices = ref<string[]>([])

// 筛选器选项
const filterOptions = ref<FilterOption[]>([
  { key: 'd_no', label: '设备编号', type: 'select', values: [] },
  { key: 'c_time', label: '时间范围', type: 'datetimerange' },
])

// 筛选器状态
const filterValue = ref<Record<string, FilterValue>>({})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [data, countResult] = await Promise.all([
      getData('data', queryParams.value),
      getCount('data', queryParams.value.where),
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
    const devices = await getDevice()
    const deviceValues = devices.map((d) => d.number).filter(Boolean)
    allDevices.value.splice(0, allDevices.value.length, ...deviceValues)
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
  const where: Record<string, { value: string; operator: '=' | '>' | '<' | '>=' | '<=' }> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue
    const opt = filterOptions.value.find((o) => o.key === key)
    // select 类型
    if (!opt?.type || opt.type === 'select') {
      where[key] = { value: String(value), operator: '=' }
    }
    // 时间范围
    if (opt?.type === 'datetimerange') {
      const [s, e] = value as [Date, Date]
      const pad = (n: number) => String(n).padStart(2, '0')
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(where as any)[key] = [
        { value: fmt(new Date(s)), operator: '>=' },
        { value: fmt(new Date(e)), operator: '<=' },
      ]
    }
    // 数值范围
    if (opt?.type === 'range') {
      const [min, max] = value as [number, number]
      const conds: { value: string; operator: '>=' | '<=' }[] = []
      if (min !== -Infinity) conds.push({ value: String(min), operator: '>=' })
      if (max !== Infinity) conds.push({ value: String(max), operator: '<=' })
      if (conds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(where as any)[key] = conds.length === 1 ? conds[0] : conds
      }
    }
  }
  whereClause.value = where
  currentPage.value = 1
  syncStateToUrl()
  loadData()
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
  fieldMappers.value = await getDataMapper('data')
  await loadFilterOptions()
  await loadData()
  syncStateToUrl()
})

// 切换 tab 时重新加载数据
async function onTabChange(tab: 'temp' | 'humi' | 'light') {
  activeTable.value = tab
  currentPage.value = 1
  await loadData()
}
</script>

<template>
  <div class="data-view">
    <div class="header-section">
      <h3>传感器数据总览</h3>
      <span class="count-tip">
        共 {{ totalCount }} 条
        <span v-if="loading" class="loading-text">(加载中...)</span>
      </span>
    </div>

    <!-- 数据类型 Tab（已禁用，恢复时去掉 v-if="false"） -->
    <ElTabs
      v-if="false"
      v-model="activeTable"
      @tab-change="(tab: any) => onTabChange(tab as 'temp' | 'humi' | 'light')"
    >
      <ElTabPane label="🌡 温度" name="temp" />
      <ElTabPane label="💧 湿度" name="humi" />
      <ElTabPane label="☀ 光照" name="light" />
    </ElTabs>

    <!-- 筛选器 -->
    <div class="filter-section">
      <DataFilter v-model="filterValue" :options="filterOptions" @change="applyFilters" />
    </div>

    <!-- 上半：表格 -->
    <div class="table-section" v-loading="loading">
      <DataTable :data="rawData" :columns="columns" @sort-change="onSortChange" />
    </div>

    <!-- 分页 -->
    <div class="pagination-section">
      <ElPagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="totalCount"
        :page-sizes="[10, 20, 50, 100]"
        :size="isMobile ? 'small' : 'default'"
        layout="total, sizes, prev, pager, next"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.data-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
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
  flex-wrap: wrap;
  position: relative;
  z-index: 3;
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
