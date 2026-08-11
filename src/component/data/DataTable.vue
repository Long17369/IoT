<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElTable, ElTableColumn, ElTag } from 'element-plus'
import type { ColumnDef, SortInfo } from '../../types/dataType'

const props = defineProps<{
  /** 要展示的数据（已由上层切片） */
  data: Record<string, unknown>[]
  columns: ColumnDef[]
  /** 是否启用行选择（在首列渲染 checkbox），默认 false */
  selectable?: boolean
}>()

const emit = defineEmits<{
  'sort-change': [info: SortInfo]
  /** 行选择变化时触发，payload 为当前选中的行数组 */
  'selection-change': [rows: Record<string, unknown>[]]
}>()

/** 表头标签（unitPlacement=header 或 both 时带单位，cell 时不带） */
function headerLabel(col: ColumnDef): string {
  if (!col.unit) return col.label
  if (col.unitPlacement === 'cell') return col.label
  return `${col.label} (${col.unit})`
}

/** ElTable 实例引用，用于外部调用 clearSelection 等方法 */
const tableRef = ref<InstanceType<typeof ElTable>>()

/** 多选变化回调 */
function onSelectionChange(rows: Record<string, unknown>[]) {
  console.log('DataTable selection-change', rows)
  emit('selection-change', rows)
}

/** 格式化时间字段：ISO/UTC → 本地可读格式 */
function formatTime(val: unknown): string {
  if (!val) return ''
  const d = new Date(val as string)
  if (isNaN(d.getTime())) return String(val)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 单元格文本（unitPlacement=cell 或 both 时带单位，header 时不带） */
function cellText(row: Record<string, unknown>, col: ColumnDef): string {
  const val = row[col.key]
  // 时间字段格式化
  if (col.key === 'c_time') return formatTime(val)
  // 值映射（由字段映射 mapper 驱动）
  if (col.mapper) {
    const key = String(val)
    const mapped = col.mapper[key]
    if (mapped !== undefined) {
      return col.showOriginal ? `${mapped} (${key})` : mapped
    }
  }
  if (!col.unit || col.unitPlacement === 'header') return String(val ?? '')
  return `${val ?? ''}${col.unit}`
}

/** 中文字符算 2 个宽度单位，英文/数字算 1 个 */
function charWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1
  }
  return w
}

/** 计算每列的最小宽度（px），基于表头+数据内容最大字符宽度 */
const columnWidths = computed(() => {
  const widths: Record<string, number> = {}
  for (const col of props.columns) {
    // 表头宽度（含单位）
    const sortSpace = col.sortable ? 40 : 0
    const headerW = charWidth(headerLabel(col)) * 8 + 16 + sortSpace
    // 取前 20 行数据中该列最大宽度
    let maxDataW = 0
    const sample = props.data.slice(0, 20)
    for (const row of sample) {
      const text = cellText(row, col)
      maxDataW = Math.max(maxDataW, charWidth(text))
    }
    const dataW = maxDataW * 8 + 16
    widths[col.key] = Math.max(headerW, dataW, 60)
  }
  return widths
})

function onSortChange(sort: { prop: string; order: string | null }) {
  emit('sort-change', {
    prop: sort.prop,
    order: (sort.order as SortInfo['order']) ?? null,
  })
}

/** 清空选中行（可通过 defineExpose 暴露给父组件） */
function clearSelection() {
  tableRef.value?.clearSelection()
}

defineExpose({ clearSelection, tableRef })
</script>

<template>
  <ElTable
    ref="tableRef"
    :data="data"
    stripe
    border
    @sort-change="onSortChange"
    @selection-change="onSelectionChange"
  >
    <ElTableColumn v-if="selectable" type="selection" width="45" align="center" />
    <ElTableColumn
      v-for="col in columns"
      :key="col.key"
      :label="headerLabel(col)"
      :prop="col.key"
      :sortable="col.sortable"
      :min-width="columnWidths[col.key]"
      align="center"
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
