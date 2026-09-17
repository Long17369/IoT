<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import {
  ElSelect,
  ElOption,
  ElTag,
  ElButton,
  ElIcon,
  ElInput,
  ElDatePicker,
  ElInputNumber,
} from 'element-plus'
import { Filter, ArrowDown, ArrowUp } from '@element-plus/icons-vue'

/** 筛选类型 */
export type FilterType = 'select' | 'text' | 'datetimerange' | 'range'

export interface FilterOption {
  key: string
  label: string
  type?: FilterType
  values?: string[]
  /** select 选项的显示名（原始值 → 显示名，如 { manual: '手动控制' }）；未命中时显示原始值 */
  labels?: Record<string, string>
  /** text 输入框占位文本 */
  placeholder?: string
  /** select 允许输入过滤并创建候选项（候选值不固定时用） */
  allowCreate?: boolean
  unit?: string
}

export type FilterValue = string | [Date, Date] | [number, number] | null

const props = defineProps<{
  options: FilterOption[]
  modelValue: Record<string, FilterValue>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, FilterValue>]
  change: [value: Record<string, FilterValue>]
}>()

const selectedValues = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('update:modelValue', val)
    emit('change', val)
  },
})

function handleSelect(key: string, value: string) {
  const nv = { ...selectedValues.value }
  if (!value) delete nv[key]
  else nv[key] = value
  selectedValues.value = nv
}

/** 'text' 类型的输入草稿：输入时不查询，回车/失焦/清空时才提交 */
const textDrafts = ref<Record<string, string>>({})

function textValue(option: FilterOption): string {
  return textDrafts.value[option.key] ?? (selectedValues.value[option.key] as string) ?? ''
}

function onTextInput(key: string, val: string) {
  textDrafts.value = { ...textDrafts.value, [key]: val }
}

/** 回车/失焦提交：以输入框当前值为准 */
function commitText(key: string, val: string) {
  const text = val ?? ''
  textDrafts.value = { ...textDrafts.value, [key]: text }
  handleSelect(key, text)
}

/** 清空（点右侧清除图标）：同步草稿并移除该筛选项 */
function clearText(key: string) {
  textDrafts.value = { ...textDrafts.value, [key]: '' }
  handleSelect(key, '')
}

function handleDateRange(key: string, value: [Date, Date] | null) {
  const nv = { ...selectedValues.value }
  if (!value) delete nv[key]
  else nv[key] = value
  selectedValues.value = nv
}

function handleRange(key: string, min: number | undefined, max: number | undefined) {
  const nv = { ...selectedValues.value }
  if (min === undefined && max === undefined) {
    delete nv[key]
  } else {
    nv[key] = [min ?? -Infinity, max ?? Infinity] as [number, number]
  }
  selectedValues.value = nv
}

function clearFilter(key: string) {
  const nv = { ...selectedValues.value }
  delete nv[key]
  selectedValues.value = nv
  delete textDrafts.value[key]
}

function clearAllFilters() {
  selectedValues.value = {}
  textDrafts.value = {}
}

/** 获取筛选值可读文本 */
function filterValueText(key: string, opt: FilterOption): string {
  const val = selectedValues.value[key]
  if (!val) return ''
  if (opt.type === 'datetimerange') {
    const [s, e] = val as [Date, Date]
    return `${new Date(s).toLocaleString()} ~ ${new Date(e).toLocaleString()}`
  }
  if (opt.type === 'range') {
    const [min, max] = val as [number, number]
    const u = opt.unit || ''
    if (min === -Infinity && max === Infinity) return ''
    if (min === -Infinity) return `≤ ${max}${u}`
    if (max === Infinity) return `≥ ${min}${u}`
    return `${min}${u} ~ ${max}${u}`
  }
  return opt.labels?.[String(val)] ?? String(val)
}
const activeFiltersList = computed(() => {
  const list: { key: string; label: string; value: string }[] = []
  for (const [key] of Object.entries(selectedValues.value)) {
    const opt = props.options.find((o) => o.key === key)
    if (opt) {
      const text = filterValueText(key, opt)
      if (text) list.push({ key, label: opt.label, value: text })
    }
  }
  return list
})

const hasActiveFilters = computed(() => activeFiltersList.value.length > 0)

// 控制筛选器展开/折叠
const isExpanded = ref(false)
const filterRootRef = ref<HTMLElement | null>(null)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function closeExpand() {
  isExpanded.value = false
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target || !filterRootRef.value) return
  const element = target as Element
  const inPopper = element.closest?.('.el-popper, .el-picker-panel, .el-select__popper')
  if (inPopper) return
  if (!filterRootRef.value.contains(target)) {
    closeExpand()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <div ref="filterRootRef" class="data-filter">
    <div class="filter-trigger" @click="toggleExpand">
      <div class="filter-collapsed-left">
        <ElIcon class="filter-icon"><Filter /></ElIcon>
        <span class="filter-title">数据筛选</span>
        <ElTag v-if="hasActiveFilters" type="info" size="small" class="filter-count">
          {{ activeFiltersList.length }}
        </ElTag>
      </div>
      <div class="filter-collapsed-right">
        <!-- 折叠时显示已选标签预览 -->
        <div v-if="hasActiveFilters" class="active-filters-preview">
          <ElTag
            v-for="filter in activeFiltersList.slice(0, 3)"
            :key="filter.key"
            closable
            size="small"
            @close.stop="clearFilter(filter.key)"
          >
            {{ filter.label }}: {{ filter.value }}
          </ElTag>
          <span v-if="activeFiltersList.length > 3" class="more-tag"
            >+{{ activeFiltersList.length - 3 }}</span
          >
        </div>
        <ElIcon class="expand-icon">
          <ArrowUp v-if="isExpanded" />
          <ArrowDown v-else />
        </ElIcon>
      </div>
    </div>

    <div v-show="isExpanded" class="filter-overlay-panel" @click.stop>
      <div class="filter-body">
        <div v-for="option in options" :key="option.key" class="filter-item">
          <span class="filter-label">{{ option.label }}</span>

          <!-- select -->
          <ElSelect
            v-if="!option.type || option.type === 'select'"
            :model-value="(selectedValues[option.key] as string) || ''"
            placeholder="全部"
            clearable
            :filterable="option.allowCreate === true"
            :allow-create="option.allowCreate === true"
            class="filter-select"
            @change="(val: string) => handleSelect(option.key, val)"
          >
            <ElOption
              v-for="v in option.values"
              :key="v"
              :label="option.labels?.[v] ?? v"
              :value="v"
            />
          </ElSelect>

          <!-- text（模糊搜索） -->
          <ElInput
            v-else-if="option.type === 'text'"
            :model-value="textValue(option)"
            :placeholder="option.placeholder || '输入关键字'"
            clearable
            class="filter-text"
            @input="(val: string) => onTextInput(option.key, val)"
            @change="(val: string) => commitText(option.key, val)"
            @clear="() => clearText(option.key)"
          />

          <!-- datetimerange -->
          <ElDatePicker
            v-else-if="option.type === 'datetimerange'"
            :model-value="(selectedValues[option.key] as [Date, Date]) || null"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            format="YYYY-MM-DD HH:mm"
            popper-class="filter-picker-popper"
            class="filter-date"
            @update:model-value="(val: [Date, Date] | null) => handleDateRange(option.key, val)"
            @change="(val: [Date, Date] | null) => handleDateRange(option.key, val)"
          />

          <!-- range -->
          <div v-else-if="option.type === 'range'" class="filter-range">
            <ElInputNumber
              :model-value="((selectedValues[option.key] as [number, number]) || [])[0]"
              placeholder="最小值"
              controls-position="right"
              size="small"
              style="width: 100px"
              @change="
                (val: number | undefined) => {
                  const cur = (selectedValues[option.key] as [number, number]) || [
                    undefined,
                    undefined,
                  ]
                  handleRange(option.key, val, cur[1])
                }
              "
            />
            <span class="range-sep">~</span>
            <ElInputNumber
              :model-value="((selectedValues[option.key] as [number, number]) || [])[1]"
              placeholder="最大值"
              controls-position="right"
              size="small"
              style="width: 100px"
              @change="
                (val: number | undefined) => {
                  const cur = (selectedValues[option.key] as [number, number]) || [
                    undefined,
                    undefined,
                  ]
                  handleRange(option.key, cur[0], val)
                }
              "
            />
            <span v-if="option.unit" class="range-unit">{{ option.unit }}</span>
          </div>
        </div>
      </div>

      <div v-if="hasActiveFilters" class="filter-footer">
        <div class="active-filters">
          <ElTag
            v-for="filter in activeFiltersList"
            :key="filter.key"
            closable
            size="small"
            @close.stop="clearFilter(filter.key)"
          >
            {{ filter.label }}: {{ filter.value }}
          </ElTag>
        </div>
        <ElButton type="primary" link size="small" @click.stop="clearAllFilters">
          清除全部
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-filter {
  position: relative;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  box-shadow: none;
  padding: 12px 16px;
  z-index: 2;
  width: 100%;
}

/* 触发条 */
.filter-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.filter-trigger:hover {
  background: #f5f7fa;
  border-radius: 4px;
}

.filter-collapsed-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.filter-collapsed-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
  min-width: 0;
}

.active-filters-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
  max-width: 400px;
}

.more-tag {
  font-size: 12px;
  color: #909399;
  padding: 0 4px;
}

.expand-icon {
  color: #909399;
  font-size: 14px;
  flex-shrink: 0;
}

/* 通用样式 */
.filter-icon {
  color: #409eff;
  font-size: 16px;
}

.filter-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.filter-count {
  margin-left: 4px;
}

/* 叠加展开层（不占布局高度） */
.filter-overlay-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 12px;
  z-index: 40;
  overflow: visible;
}

.filter-body {
  display: grid;
  /* 等宽分列：换行时最后一行不会被撑得比其它项宽 */
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 12px;
  align-items: start;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-width: 420px;
  height: auto;
}

.filter-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.filter-select {
  width: 100%;
}

.filter-text {
  width: 100%;
}

:deep(.filter-date) {
  /* 项目没有全局 border-box 重置：不改 box-sizing 时 width:100% 是内容宽，
     再加上左右 padding 会超出父容器 */
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
}

/* 日期范围选择器内部两个 input 的 min-width 默认为内容宽（≈126px），
   不置 0 会撑破外层容器（两个 input + 分隔符 + 图标 > 可用宽度） */
:deep(.filter-date .el-range-input) {
  min-width: 0;
}

:deep(.filter-picker-popper) {
  z-index: 5000;
  pointer-events: auto;
}

.filter-range {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.range-sep {
  color: #909399;
  font-size: 13px;
}

.range-unit {
  font-size: 12px;
  color: #909399;
}

.filter-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

/* 移动端适配 */
@media (max-width: 767px) {
  .data-filter {
    padding: 10px 12px;
  }

  .filter-overlay-panel {
    top: calc(100% + 6px);
    padding: 10px;
  }

  .active-filters-preview {
    max-width: 150px;
  }

  .filter-title {
    font-size: 13px;
  }

  .filter-body {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .filter-item {
    width: 100%;
    max-width: 100%;
  }

  .filter-label {
    font-size: 12px;
  }

  .filter-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
