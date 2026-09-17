<script setup lang="ts">
import { computed } from 'vue'
import { fmtNum } from '@/utils/format'

interface Props {
  title: string
  value: string | number | null | undefined
  unit?: string
  trend?: 'up' | 'down' | 'stable' | 'right'
  /** 状态: normal=正常, warning=警告, danger=危险 */
  status?: 'normal' | 'warning' | 'danger'
  /** 值为空（null / undefined / 空串）时显示的占位文本，默认空白 */
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  trend: 'stable',
  status: 'normal',
  emptyText: '',
})

/** 空值（缺测：库中 NULL / 推送空串）判定 */
const isEmpty = computed(
  () => props.value === null || props.value === undefined || props.value === '',
)

/** 显示值：空值显示占位文本；超 2 位小数截断（整数/短小数/非数值原样） */
const displayValue = computed(() => (isEmpty.value ? props.emptyText : fmtNum(props.value)))

/** 空值不显示单位，避免出现「离线 °C」 */
const showUnit = computed(() => !!props.unit && !isEmpty.value)

const trendIcon = computed(() => {
  switch (props.trend) {
    case 'up':
      return '↑'
    case 'down':
      return '↓'
    case 'right':
      return '→'
    default:
      return ''
  }
})

const trendClass = computed(() => `trend-${props.trend}`)

const statusColor = computed(() => {
  switch (props.status) {
    case 'warning':
      return '#e6a23c'
    case 'danger':
      return '#f56c6c'
    default:
      return '#67c23a'
  }
})
</script>

<template>
  <div class="status-card" :class="`status-${status}`">
    <div class="card-header">
      <span class="card-title">{{ title }}</span>
      <span class="card-trend" :class="trendClass">{{ trendIcon }}</span>
    </div>
    <div class="card-body">
      <span class="card-value" :style="{ color: statusColor }">{{ displayValue }}</span>
      <span v-if="showUnit" class="card-unit">{{ unit }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border-left: 4px solid #67c23a;
}

.status-card.status-warning {
  border-left-color: #e6a23c;
  background: #fdf6ec;
}

.status-card.status-danger {
  border-left-color: #f56c6c;
  background: #fef0f0;
  animation: pulse-danger 2s infinite;
}

@keyframes pulse-danger {
  0%,
  100% {
    box-shadow: 0 2px 12px rgba(245, 108, 108, 0.2);
  }
  50% {
    box-shadow: 0 2px 24px rgba(245, 108, 108, 0.5);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

.card-trend {
  font-size: 18px;
  font-weight: bold;
}

.trend-up {
  color: #f56c6c;
}
.trend-down {
  color: #67c23a;
}
.trend-stable {
  color: #909399;
}

.card-body {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}

.card-unit {
  font-size: 14px;
  color: #909399;
}
</style>
