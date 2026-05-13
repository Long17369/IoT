<script setup lang="ts">
import { ElTable, ElTableColumn, ElTag } from 'element-plus'
import type { ColumnDef, SortInfo } from '../../types/dataType'

defineProps<{
  /** 要展示的数据（已由上层切片） */
  data: Record<string, unknown>[]
  columns: ColumnDef[]
}>()

const emit = defineEmits<{
  'sort-change': [info: SortInfo]
}>()

/** 表头标签（unitPlacement=header 或 both 时带单位，cell 时不带） */
function headerLabel(col: ColumnDef): string {
  if (!col.unit) return col.label
  if (col.unitPlacement === 'cell') return col.label
  return `${col.label} (${col.unit})`
}

/** 单元格文本（unitPlacement=cell 或 both 时带单位，header 时不带） */
function cellText(row: Record<string, unknown>, col: ColumnDef): string {
  const val = row[col.key]
  if (!col.unit || col.unitPlacement === 'header') return String(val ?? '')
  return `${val ?? ''}${col.unit}`
}

function onSortChange(sort: { prop: string; order: string | null }) {
  emit('sort-change', {
    prop: sort.prop,
    order: (sort.order as SortInfo['order']) ?? null,
  })
}
</script>

<template>
  <ElTable :data="data" stripe border @sort-change="onSortChange">
    <ElTableColumn
      v-for="col in columns"
      :key="col.key"
      :label="headerLabel(col)"
      :prop="col.key"
      :sortable="col.sortable ? 'custom' : false"
    >
      <template #default="{ row }">
        <ElTag v-if="col.chartable" size="small" type="primary" effect="plain">
          {{ cellText(row, col) }}
        </ElTag>
        <span v-else>{{ cellText(row, col) }}</span>
      </template>
    </ElTableColumn>
  </ElTable>
</template>

<style scoped>
:deep(.el-table__body-wrapper)::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
:deep(.el-table__body-wrapper)::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}
:deep(.el-table__body-wrapper)::-webkit-scrollbar-track {
  background: transparent;
}
</style>
