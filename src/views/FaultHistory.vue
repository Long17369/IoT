<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElPagination } from 'element-plus'
import DataTable from '../component/data/DataTable.vue'
import DataFilter from '../component/data/DataFilter.vue'
import { useAlarmData } from '../composables/useAlarmData'
import { getDataDevices } from '../server/api'
import type { ColumnDef } from '../types/dataType'
import type { FilterOption, FilterValue } from '../component/data/DataFilter.vue'
import type { Data, Where } from '@/server/types'

const {
  data: rawData,
  fieldMappers,
  totalCount,
  loading,
  queryParams,
  currentPage,
  fetchFieldMappers,
  fetchData,
  fetchCount,
} = useAlarmData()

// 分页
const pageSize = ref(10)

// 筛选条件
const whereClause = ref<Where>({})

// 从 FieldMapper 生成列（全为 FieldMapper 驱动）
const columns = computed<ColumnDef[]>(() => {
  const sortedMappers = fieldMappers.value
    .filter((m) => m.visible === '1')
    .sort((a, b) => a.id - b.id)

  return sortedMappers.map((m) => ({
    key: m.db_name,
    label: m.f_name,
    unit: m.unit || undefined,
    unitPlacement: 'header' as const,
    chartable: m.chartable === '1',
    sortable: true,
  }))
})

// 筛选选项：设备编号 + 时间范围 + 错误信息（模糊搜索）+ 错误代码（筛选）
const filterOptions = computed<FilterOption[]>(() => [
  { key: 'd_no', label: '设备编号', type: 'select', values: deviceOptions.value },
  { key: 'c_time', label: '时间范围', type: 'datetimerange' },
  { key: 'field1', label: '错误信息', type: 'text', placeholder: '输入关键字搜索' },
  {
    key: 'field2',
    label: '错误代码',
    type: 'select',
    values: errorCodeOptions.value,
    allowCreate: true,
  },
])

// 设备选项（用于 d_no 下拉）
const deviceOptions = ref<string[]>([])

// 错误代码候选值：后端无 distinct 接口，从已加载过的数据里累积去重
const errorCodeOptions = ref<string[]>([])

function collectErrorCodes(rows: Data[]) {
  const codes = new Set(errorCodeOptions.value)
  for (const row of rows) {
    if (row.field2) codes.add(row.field2)
  }
  if (codes.size !== errorCodeOptions.value.length) {
    errorCodeOptions.value = [...codes].sort()
  }
}

// 筛选器状态
const filterValue = ref<Record<string, FilterValue>>({})

// 加载数据
async function loadData() {
  try {
    const [rows, count] = await Promise.all([
      fetchData({
        limit: pageSize.value,
        offset: (currentPage.value - 1) * pageSize.value,
        order_table: 'id',
        desc: true,
        where: whereClause.value,
      }),
      fetchCount(whereClause.value),
    ])
    totalCount.value = count
    collectErrorCodes(rows)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载故障数据失败')
  }
}

// 应用筛选
function applyFilters() {
  const where: Where = {}
  for (const [key, value] of Object.entries(filterValue.value)) {
    if (!value) continue
    const opt = filterOptions.value.find((o) => o.key === key)
    // select（默认）
    if (!opt?.type || opt.type === 'select') {
      where[key] = { value: String(value), operator: '=' }
    }
    // 文本搜索（模糊匹配）
    if (opt?.type === 'text') {
      where[key] = { value: `%${String(value)}%`, operator: 'like' }
    }
    // 时间范围（Date 直接进 where，经 JSON.stringify 序列化为 ISO 8601 UTC）
    if (opt?.type === 'datetimerange') {
      const [s, e] = value as [Date, Date]
      where[key] = [
        { value: s, operator: '>=' },
        { value: e, operator: '<=' },
      ]
    }
  }
  whereClause.value = where
  queryParams.value.offset = 0
  loadData()
}

// 分页
function onPageChange(page: number) {
  queryParams.value.offset = (page - 1) * pageSize.value
  loadData()
}

function onSizeChange(size: number) {
  pageSize.value = size
  queryParams.value.offset = 0
  loadData()
}

// 加载设备选项
async function loadDeviceOptions() {
  try {
    deviceOptions.value = await getDataDevices()
  } catch {
    // 忽略加载失败
  }
}

// 初始化
onMounted(async () => {
  await fetchFieldMappers()
  await loadDeviceOptions()
  await loadData()
})
</script>

<template>
  <div class="fault-history">
    <div class="header-section">
      <h3>故障历史记录</h3>
      <span class="count-tip">
        共 {{ totalCount }} 条
        <span v-if="loading" class="loading-text">(加载中...)</span>
      </span>
    </div>

    <div class="filter-section">
      <DataFilter v-model="filterValue" :options="filterOptions" @change="applyFilters" />
    </div>

    <div class="table-section" v-loading="loading">
      <DataTable :data="rawData" :columns="columns" />
    </div>

    <div class="pagination-section">
      <ElPagination
        :current-page="currentPage"
        v-model:page-size="pageSize"
        :total="totalCount"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.fault-history {
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
}

.table-section {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.pagination-section {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

@media (max-width: 767px) {
  .fault-history {
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
}
</style>
