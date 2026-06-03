<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElSelect, ElOption } from 'element-plus'
import ControlSwitch from './ControlSwitch.vue'
import ControlSlider from './ControlSlider.vue'
import { updateDirectData } from '@/server/api'
import type { DirectConfig, Direct } from '@/server/types'

interface Props {
  configs: DirectConfig[]
  directValues: Direct[]
  dNo: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  updated: []
}>()

/** 本地乐观更新的值缓存，优先于 props.directValues */
const localValues = ref<Record<string, string>>({})

// 当 directValues 更新后，清除已同步的本地缓存
watch(
  () => props.directValues,
  (newValues) => {
    const fresh: Record<string, string> = {}
    for (const [key, val] of Object.entries(localValues.value)) {
      const synced = newValues.find((d) => d.config_id === key)
      if (!synced || synced.value !== val) {
        fresh[key] = val
      }
    }
    localValues.value = fresh
  },
)

/** 根据 config_id 获取当前指令值 */
function getDirectValue(configId: string): string | null {
  const value = localValues.value[configId]
  if (value !== undefined) return value
  const item = props.directValues.find((d) => d.config_id === configId)
  return item?.value ?? null
}

/** 解析 f_value（格式: "标签1:值1|标签2:值2"），返回 [offCode, onCode, offLabel, onLabel] */
function parseSwitchCodes(fValue: string): [string, string, string, string] {
  const parts = fValue.split('|').map((opt) => {
    const idx = opt.indexOf(':')
    return idx >= 0 ? [opt.slice(0, idx), opt.slice(idx + 1)] : [opt, opt]
  })
  return [parts[0]?.[1] ?? '0', parts[1]?.[1] ?? '1', parts[0]?.[0] ?? '关', parts[1]?.[0] ?? '开']
}

/** 解析 f_type=1 开关的当前值 */
function isSwitchOn(config: DirectConfig): boolean {
  const val = getDirectValue(config.id)
  if (!val) return false
  if (config.f_value) {
    const [, onCode] = parseSwitchCodes(config.f_value)
    return val === onCode
  }
  return val === '1'
}

/** 获取开关的标签文字 */
function getSwitchLabels(config: DirectConfig): { off: string; on: string } {
  if (config.f_value) {
    const [, , offLabel, onLabel] = parseSwitchCodes(config.f_value)
    return { off: offLabel, on: onLabel }
  }
  return { off: '关', on: '开' }
}

/** 获取滑动条当前数值 */
function getSliderValue(config: DirectConfig): number {
  const val = getDirectValue(config.id)
  if (!val) return 0
  const num = parseFloat(val)
  return isNaN(num) ? 0 : num
}

async function handleSwitchChange(config: DirectConfig, value: boolean) {
  if (props.disabled) return
  const [offCode, onCode] = config.f_value ? parseSwitchCodes(config.f_value) : ['0', '1']
  const sendValue = value ? onCode : offCode

  // 乐观更新 UI
  localValues.value = { ...localValues.value, [config.id]: sendValue }
  // 异步提交，不阻塞 UI
  updateDirectData({ config_id: config.id, value: sendValue, d_no: props.dNo })
    .then(() => emit('updated'))
    .catch((e) => console.error('指令下发失败:', e))
}

async function handleInputChange(config: DirectConfig, rawValue: string) {
  if (props.disabled || !rawValue) return

  const numValue = parseFloat(rawValue)
  if (isNaN(numValue)) return
  if (config.type === 'int' && !Number.isInteger(numValue)) return

  const min = config.min ? parseFloat(config.min) : undefined
  const max = config.max ? parseFloat(config.max) : undefined
  if (min !== undefined && numValue < min) return
  if (max !== undefined && numValue > max) return

  // 乐观更新 UI
  localValues.value = { ...localValues.value, [config.id]: String(numValue) }
  // 异步提交，不阻塞 UI
  updateDirectData({ config_id: config.id, value: String(numValue), d_no: props.dNo })
    .then(() => emit('updated'))
    .catch((e) => console.error('指令下发失败:', e))
}

async function handleSelectChange(config: DirectConfig, value: string) {
  if (props.disabled || !value) return
  // 乐观更新 UI
  localValues.value = { ...localValues.value, [config.id]: value }
  // 异步提交，不阻塞 UI
  updateDirectData({ config_id: config.id, value, d_no: props.dNo })
    .then(() => emit('updated'))
    .catch((e) => console.error('指令下发失败:', e))
}

/** 构建 configId → DirectConfig 的映射 */
const configMap = computed(() => {
  const map = new Map<string, DirectConfig>()
  for (const c of props.configs) {
    map.set(c.id, c)
  }
  return map
})

/**
 * 判断指令是否应该显示（基于 f_type 和父项条件，递归检查祖先可见性）
 */
const visibilityCache = new Map<string, boolean>()

function isConfigVisible(config: DirectConfig): boolean {
  const cached = visibilityCache.get(config.id)
  if (cached !== undefined) return cached

  if (!['1', '2', '3', '5'].includes(config.f_type)) {
    visibilityCache.set(config.id, false)
    return false
  }

  if (!config.ref_id) {
    visibilityCache.set(config.id, true)
    return true
  }

  const parent = configMap.value.get(config.ref_id)
  if (!parent || !isConfigVisible(parent)) {
    visibilityCache.set(config.id, false)
    return false
  }

  const parentValue = getDirectValue(config.ref_id)
  if (parentValue === null || parentValue === undefined || parentValue === '') {
    visibilityCache.set(config.id, false)
    return false
  }

  if (!config.ref_value) {
    visibilityCache.set(config.id, true)
    return true
  }

  const allowedValues = config.ref_value.split('|')
  const result = allowedValues.includes(parentValue)
  visibilityCache.set(config.id, result)
  return result
}

watch([() => props.configs, () => props.directValues], () => {
  visibilityCache.clear()
})

const visibleConfigs = computed(() => props.configs.filter(isConfigVisible))

function parseOptionValue(opt: string): { label: string; value: string }[] {
  return opt.split('|').map((item) => {
    const idx = item.indexOf(':')
    return idx >= 0
      ? { label: item.slice(0, idx), value: item.slice(idx + 1) }
      : { label: item, value: item }
  })
}
</script>

<template>
  <div class="control-panel">
    <div v-if="visibleConfigs.length === 0" class="empty-hint">暂无可用控制项</div>

    <TransitionGroup name="control-list" tag="div">
      <template v-for="config in visibleConfigs" :key="config.id">
        <!-- 开关类型 -->
        <ControlSwitch
          v-if="config.f_type === '1'"
          :label="config.t_name"
          :model-value="isSwitchOn(config)"
          :disabled="disabled"
          :active-text="getSwitchLabels(config).on"
          :inactive-text="getSwitchLabels(config).off"
          @change="(v: boolean) => handleSwitchChange(config, v)"
        />

        <!-- 单选框类型（f_type=5），二选一用开关，多选用下拉 -->
        <!-- 单选框类型（f_type=5），渲染为下拉选择 -->
        <div v-else-if="config.f_type === '5'" class="control-select">
          <span class="input-label">{{ config.t_name }}</span>
          <ElSelect
            :model-value="getDirectValue(config.id) || ''"
            :disabled="disabled"
            placeholder="请选择"
            size="default"
            style="width: 160px"
            @update:model-value="(v: string | number) => handleSelectChange(config, String(v))"
          >
            <ElOption
              v-for="opt in parseOptionValue(config.f_value || '')"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
        </div>
        <ControlSlider
          v-else-if="config.f_type === '3'"
          :label="config.t_name"
          :model-value="getSliderValue(config)"
          :min="config.min ? parseFloat(config.min) : 0"
          :max="config.max ? parseFloat(config.max) : 100"
          @change="(v: number) => handleInputChange(config, String(v))"
        />

        <!-- 输入框类型（阈值设置） -->
        <div v-else-if="config.f_type === '2'" class="control-input">
          <span class="input-label">{{ config.t_name }}</span>
          <input
            class="threshold-input"
            type="number"
            :value="getDirectValue(config.id) || ''"
            :placeholder="'请输入' + config.t_name"
            :min="config.min || undefined"
            :max="config.max || undefined"
            :step="config.type === 'int' ? '1' : 'any'"
            :disabled="disabled"
            @blur="
              (e: FocusEvent) => {
                const target = e.target as HTMLInputElement
                handleInputChange(config, target.value)
              }
            "
            @keyup.enter="
              (e: KeyboardEvent) => {
                const target = e.target as HTMLInputElement
                handleInputChange(config, target.value)
              }
            "
          />
        </div>
      </template>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
}

/* 列表过渡动画 */
.control-list-enter-active,
.control-list-leave-active {
  transition: all 0.3s ease;
}
.control-list-enter-from,
.control-list-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.control-list-leave-active {
  position: absolute;
}

.empty-hint {
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 14px;
}

.control-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 8px;
}

.input-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.threshold-input {
  width: 120px;
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 14px;
  text-align: right;
  outline: none;
  transition: border-color 0.2s;
}

.threshold-input:focus {
  border-color: #409eff;
}

.threshold-input:disabled {
  background: #f5f7fa;
  cursor: not-allowed;
}

.control-select {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 8px;
}
</style>
