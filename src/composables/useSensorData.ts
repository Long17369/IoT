import { ref, computed } from 'vue'
import { getData, getDataMapper, getCount, getTimeRange } from '@/server/api'
import type { Data, FrontendDataQueryParams, FieldMapper, Where } from '@/server/types'

export function useSensorData() {
  // 数据状态
  const data = ref<Data[]>([])
  const fieldMappers = ref<FieldMapper[]>([])
  const totalCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 查询参数
  const queryParams = ref<FrontendDataQueryParams>({
    limit: 10,
    offset: 0,
    order_table: 'id',
    desc: true,
    where: {},
  })

  // 获取字段映射
  async function fetchFieldMappers() {
    try {
      const result = await getDataMapper('data')
      fieldMappers.value = result
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取字段映射失败'
      throw err
    }
  }

  // 获取数据
  async function fetchData(params?: Partial<FrontendDataQueryParams>) {
    loading.value = true
    error.value = null

    try {
      const mergedParams = { ...queryParams.value, ...params }
      queryParams.value = mergedParams

      const result = await getData('data', mergedParams)
      data.value = result
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 获取数据总数
  async function fetchCount(where?: Where) {
    try {
      const result = await getCount('data', where || queryParams.value.where || {})
      totalCount.value = result.count
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取数据总数失败'
      throw err
    }
  }

  // 获取时间范围
  async function fetchTimeRange(where?: Where) {
    try {
      const result = await getTimeRange('data', where || queryParams.value.where || {})
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取时间范围失败'
      throw err
    }
  }

  // 设置筛选条件
  function setFilter(key: string, value: string | null) {
    const newWhere = { ...queryParams.value.where }
    if (value === null) {
      delete newWhere[key]
    } else {
      newWhere[key] = { value, operator: '=' }
    }
    queryParams.value = { ...queryParams.value, where: newWhere, offset: 0 }
  }

  // 清除所有筛选
  function clearFilters() {
    queryParams.value = { ...queryParams.value, where: {}, offset: 0 }
  }

  // 设置分页
  function setPagination(offset: number, limit?: number) {
    queryParams.value = {
      ...queryParams.value,
      offset,
      ...(limit && { limit }),
    }
  }

  // 设置排序
  function setSort(order_table: string, desc: boolean) {
    queryParams.value = { ...queryParams.value, order_table, desc }
  }

  // 当前页数据
  const currentPage = computed(() => {
    return Math.floor(queryParams.value.offset! / queryParams.value.limit!) + 1
  })

  // 总页数
  const totalPages = computed(() => {
    return Math.ceil(totalCount.value / queryParams.value.limit!)
  })

  // 是否有更多数据
  const hasMore = computed(() => {
    return queryParams.value.offset! + queryParams.value.limit! < totalCount.value
  })

  return {
    // 状态
    data,
    fieldMappers,
    totalCount,
    loading,
    error,
    queryParams,

    // 计算属性
    currentPage,
    totalPages,
    hasMore,

    // 方法
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
