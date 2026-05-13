<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElRadioGroup, ElRadioButton } from 'element-plus'
import DataTable from './DataTable.vue'
import DataChart from './DataChart.vue'
import type { ColumnDef, DisplayMode, SortInfo } from '../../types/dataType'

const MODE_LABELS: Record<DisplayMode, string> = {
  table: '表格',
  line: '折线图',
  bar: '柱状图',
  pie: '饼图',
}

const props = withDefaults(
  defineProps<{
    data: Record<string, unknown>[]
    count: number
    columns: ColumnDef[]
    /** 允许的展示模式，默认全部 */
    modes?: DisplayMode[]
  }>(),
  {
    modes: () => ['table', 'line', 'bar', 'pie'],
  },
)

const emit = defineEmits<{
  'sort-change': [info: SortInfo]
}>()

// 默认选中第一个可用模式
const mode = ref<DisplayMode>(props.modes[0] ?? 'table')

const displayData = computed(() => props.data.slice(0, props.count))

const isChart = computed(() => mode.value !== 'table')

function onSortChange(info: SortInfo) {
  emit('sort-change', info)
}
</script>

<template>
  <div class="data-display">
    <div class="toolbar">
      <ElRadioGroup v-model="mode" size="small">
        <ElRadioButton v-for="m in modes" :key="m" :value="m">
          {{ MODE_LABELS[m] }}
        </ElRadioButton>
      </ElRadioGroup>
      <span class="count-tip">共 {{ displayData.length }} 条</span>
    </div>

    <DataTable v-if="!isChart" :data="displayData" :columns="columns" @sort-change="onSortChange" />

    <DataChart v-else :data="displayData" :columns="columns" :mode="mode" />
  </div>
</template>

<style scoped>
.data-display {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.count-tip {
  color: #909399;
  font-size: 13px;
}
</style>
