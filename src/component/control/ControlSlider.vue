<script setup lang="ts">
import { ElSlider } from 'element-plus'

interface Props {
  label: string
  modelValue: number
  min?: number
  max?: number
  unit?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  unit: '',
})

void props

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: [value: number]
}>()

function handleChange(value: number) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div class="control-slider">
    <div class="slider-header">
      <span class="slider-label">{{ label }}</span>
      <span class="slider-value">{{ modelValue }}{{ unit }}</span>
    </div>
    <ElSlider
      :model-value="modelValue"
      :min="min"
      :max="max"
      :show-tooltip="false"
      @update:model-value="
        (val: number | number[]) => handleChange(Array.isArray(val) ? (val[0] ?? 0) : val)
      "
    />
  </div>
</template>

<style scoped>
.control-slider {
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.slider-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.slider-value {
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
}
</style>
