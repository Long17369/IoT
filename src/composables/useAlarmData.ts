import { ref, computed } from 'vue'
import {
  getData,
  getDataMapper,
  getCount,
  getTimeRange,
} from '@/server/api'
import type { Data, FrontendDataQueryParams, FieldMapper } from '@/server/types'

export function useAlarmData() {
  const data = ref<Data[]>([])
  const fieldMappers = ref<FieldMapper[]>([])
  const totalCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const queryParams = ref<FrontendDataQueryParams>({
    limit: 10,
    offset: 0,
    order_table: 'id',
    desc: true,
    where: {},
  })

  async function fetchFieldMappers() {
    try {
      const result = await getDataMapper('error')
      fieldMappers.value = result
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取故障字段映射失败'
      throw err
    }
  }

  async function fetchData(params?: Partial<FrontendDataQueryParams>) {
    loading.value = true
    error.value = null
    try {
      const merged = { ...queryParams.value, ...params }
      queryParams.value = merged
      const result = await getData('error', merged)
      data.value = result
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取故障数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchCount(where?: object) {
    try {
      const result = await getCount('error', where || queryParams.value.where || {})
      totalCount.value = result.count
      return result.count
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取故障总数失败'
      throw err
    }
  }

  async function fetchTimeRange(where?: object) {
    try {
      return await getTimeRange('error', where || queryParams.value.where || {})
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取时间范围失败'
      throw err
    }
  }

  function setFilter(key: string, value: string | null) {
    const newWhere = { ...queryParams.value.where }
    if (value === null) {
      delete newWhere[key]
    } else {
      newWhere[key] = { value, operator: '=' as const }
    }
    queryParams.value = { ...queryParams.value, where: newWhere, offset: 0 }
  }

  function clearFilters() {
    queryParams.value = { ...queryParams.value, where: {}, offset: 0 }
  }

  function setPagination(offset: number, limit?: number) {
    queryParams.value = { ...queryParams.value, offset, ...(limit && { limit }) }
  }

  function setSort(order_table: string, desc: boolean) {
    queryParams.value = { ...queryParams.value, order_table, desc }
  }

  const currentPage = computed(
    () => Math.floor(queryParams.value.offset! / queryParams.value.limit!) + 1,
  )

  const totalPages = computed(() => Math.ceil(totalCount.value / queryParams.value.limit!))

  return {
    data,
    fieldMappers,
    totalCount,
    loading,
    error,
    queryParams,
    currentPage,
    totalPages,
    fetchFieldMappers,
    fetchData,
    fetchCount,
    fetchTimeRange,
    setFilter,
    clearFilters,
    setPagination,
    setSort,
  }
}
