<script setup lang="ts">
import { ElSwitch } from 'element-plus'

interface Props {
  label: string
  modelValue: boolean
  loading?: boolean
  activeText?: string
  inactiveText?: string
}

const props = withDefaults(defineProps<Props>(), {
  activeText: '开',
  inactiveText: '关',
})

void props

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

function handleChange(value: boolean) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div class="control-switch">
    <span class="switch-label">{{ label }}</span>
    <ElSwitch
      :model-value="modelValue"
      :loading="loading"
      :active-text="activeText"
      :inactive-text="inactiveText"
      @update:model-value="(val: string | number | boolean) => handleChange(Boolean(val))"
    />
  </div>
</template>

<style scoped>
.control-switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 8px;
}

.switch-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
</style>
