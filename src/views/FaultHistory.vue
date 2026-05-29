<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElPagination } from 'element-plus'
import DataTable from '../component/data/DataTable.vue'
import DataFilter from '../component/data/DataFilter.vue'
import { useAlarmData } from '../composables/useAlarmData'
import type { ColumnDef } from '../types/dataType'
import type { FilterOption, FilterValue } from '../component/data/DataFilter.vue'
import type { Where } from '@/server/types'

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

// 移动端检测
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)

onMounted(() => {
  window.addEventListener('resize', () => {
    windowWidth.value = window.innerWidth
  })
})

// 分页
const pageSize = ref(10)

// 筛选条件
const whereClause = ref<Where>({})

// 从 FieldMapper 生成列（全为 FieldMapper 驱动）
const columns = computed<ColumnDef[]>(() => {
  const baseColumns: ColumnDef[] = [
    { key: 'id', label: 'ID', chartable: false, sortable: true },
    { key: 'd_no', label: '设备编号', chartable: false, sortable: true },
    { key: 'c_time', label: '故障时间', chartable: false, sortable: true },
  ]

  const sortedMappers = fieldMappers.value
    .filter((m) => m.visible === '1')
    .sort((a, b) => a.id - b.id)

  const mapperColumns: ColumnDef[] = sortedMappers.map((m) => ({
    key: m.db_name,
    label: m.f_name,
    unit: m.unit || undefined,
    unitPlacement: 'header' as const,
    chartable: false,
    sortable: true,
  }))

  return [...baseColumns, ...mapperColumns]
})

// 从 FieldMapper 生成筛选选项
const filterOptions = computed<FilterOption[]>(() => {
  const opts: FilterOption[] = [
    {
      key: 'd_no',
      label: '设备编号',
      values: [],
    },
  ]

  const sorted = fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id)

  for (const m of sorted) {
    opts.push({
      key: m.db_name,
      label: m.f_name,
      values: [], // 从数据中动态提取
    })
  }

  return opts
})

// 筛选器状态
const filterValue = ref<Record<string, FilterValue>>({})

// 加载数据
async function loadData() {
  try {
    const [, count] = await Promise.all([
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
  } catch {
    // handled in composable
  }
}

// 应用筛选
function applyFilters() {
  const where: Where = {}
  for (const [key, value] of Object.entries(filterValue.value)) {
    if (value) {
      const val = Array.isArray(value)
        ? value[0] instanceof Date
          ? value[0].toISOString().slice(0, 19).replace('T', ' ')
          : String(value[0])
        : value
      if (val) where[key] = { value: val, operator: '=' }
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

// 初始化
onMounted(async () => {
  await fetchFieldMappers()
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
