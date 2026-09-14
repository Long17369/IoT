<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElSelect, ElOption, ElMessage } from 'element-plus'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
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

/** 本地乐观更新的值缓存，优先于 props.directValues */
const localValues = ref<Record<string, string>>({})

// 当 directValues 更新后，清除已同步的本地缓存；
// 服务端已有该配置值时一律以服务端为准（含设备状态回传 source=device、自动控制等外部变更），
// 丢弃可能过期的乐观值——否则设备未真正开启时开关会被乐观值卡在"开"
watch(
  () => props.directValues,
  (newValues) => {
    const fresh: Record<string, string> = {}
    for (const [key, val] of Object.entries(localValues.value)) {
      const synced = newValues.find((d) => d.config_id === key)
      if (!synced) {
        fresh[key] = val
      }
    }
    localValues.value = fresh
  },
)

/** 根据 config_id 获取当前指令值；directValues 无值/为空时回退配置默认值 */
function getDirectValue(configId: string, fallback?: string | null): string | null {
  const value = localValues.value[configId]
  if (value !== undefined) return value
  const item = props.directValues.find((d) => d.config_id === configId)
  if (item?.value !== null && item?.value !== undefined && item?.value !== '') return item.value
  return fallback ?? null
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
  const val = getDirectValue(config.id, config.default_value)
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
  const val = getDirectValue(config.id, config.default_value)
  if (!val) return 0
  const num = parseFloat(val)
  return isNaN(num) ? 0 : num
}

/** 计算滑动条步长：int=1，float 按范围/100 自适应小数精度 */
function getSliderStep(config: DirectConfig): number {
  if (config.type === 'int') return 1
  const min = config.min ? parseFloat(config.min) : 0
  const max = config.max ? parseFloat(config.max) : 100
  const range = max - min
  return range > 0 ? Math.max(range / 100, 0.001) : 0.01
}

/** 回滚乐观更新：移除本地缓存，回落显示服务端实际值（如后端拒绝开启水泵/加热时） */
function rollbackLocal(configId: string) {
  if (!(configId in localValues.value)) return
  const next = { ...localValues.value }
  delete next[configId]
  localValues.value = next
}

async function handleSwitchChange(config: DirectConfig, value: boolean) {
  if (props.disabled) return
  const [offCode, onCode] = config.f_value ? parseSwitchCodes(config.f_value) : ['0', '1']
  const sendValue = value ? onCode : offCode

  // 乐观更新 UI
  localValues.value = { ...localValues.value, [config.id]: sendValue }
  // 异步提交，不阻塞 UI；服务端状态变更统一由 WS direct 事件同步（见 StorageControl），不使用返回值触发刷新
  updateDirectData({ config_id: config.id, value: sendValue, d_no: props.dNo }).catch((e) => {
    console.error('指令下发失败:', e)
    rollbackLocal(config.id) // 回滚乐观值，恢复显示服务端实际状态
    ElMessage.error(e instanceof Error ? e.message : '指令下发失败')
  })
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

  // 滑动条按步长精度规整，避免浮点误差（如 0.30000000000000004）写入
  let sendValue = String(numValue)
  if (config.type === 'float' && config.f_type === '3') {
    const step = getSliderStep(config)
    const decimals = Math.max(0, Math.min(6, Math.round(-Math.log10(step))))
    sendValue = numValue.toFixed(decimals)
  }

  // 乐观更新 UI
  localValues.value = { ...localValues.value, [config.id]: sendValue }
  // 异步提交，不阻塞 UI；服务端状态变更统一由 WS direct 事件同步（见 StorageControl），不使用返回值触发刷新
  updateDirectData({ config_id: config.id, value: sendValue, d_no: props.dNo }).catch((e) => {
    console.error('指令下发失败:', e)
    rollbackLocal(config.id) // 回滚乐观值，恢复显示服务端实际状态
    ElMessage.error(e instanceof Error ? e.message : '指令下发失败')
  })
}

async function handleSelectChange(config: DirectConfig, value: string) {
  if (props.disabled || !value) return
  // 乐观更新 UI
  localValues.value = { ...localValues.value, [config.id]: value }
  // 异步提交，不阻塞 UI；服务端状态变更统一由 WS direct 事件同步（见 StorageControl），不使用返回值触发刷新
  updateDirectData({ config_id: config.id, value, d_no: props.dNo }).catch((e) => {
    console.error('指令下发失败:', e)
    rollbackLocal(config.id) // 回滚乐观值，恢复显示服务端实际状态
    ElMessage.error(e instanceof Error ? e.message : '指令下发失败')
  })
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

  // if (!['1', '2', '3', '5'].includes(config.f_type)) {
  //   visibilityCache.set(config.id, false)
  //   return false
  // }

  if (!config.ref_id) {
    visibilityCache.set(config.id, true)
    return true
  }

  const parent = configMap.value.get(config.ref_id)
  if (!parent || !isConfigVisible(parent)) {
    visibilityCache.set(config.id, false)
    return false
  }

  const parentValue = getDirectValue(config.ref_id, parent.default_value)
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

const visibleConfigs = computed(() =>
  props.configs
    .filter(isConfigVisible)
    .sort((a, b) => (parseInt(a.order ?? '0', 10) || 0) - (parseInt(b.order ?? '0', 10) || 0)),
)

function parseOptionValue(opt: string): { label: string; value: string }[] {
  return opt.split('|').map((item) => {
    const idx = item.indexOf(':')
    return idx >= 0
      ? { label: item.slice(0, idx), value: item.slice(idx + 1) }
      : { label: item, value: item }
  })
}

// ========== 按父级分组折叠 ==========

/** 折叠状态存 localStorage（只记录被折叠的分组，默认全展开） */
const COLLAPSE_KEY = 'iot:control-panel:collapsed'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

const collapsedGroups = ref<Record<string, boolean>>(loadCollapsed())

/** 有可见子项的父项才显示折叠箭头（子项全被父项条件隐藏时，展开也是空的） */
const toggleableIds = computed(() => {
  const ids = new Set<string>()
  for (const config of visibleConfigs.value) {
    if (config.ref_id) ids.add(config.ref_id)
  }
  return ids
})

/** 该项当前是否有可展开的子配置 */
function hasChildren(configId: string): boolean {
  return toggleableIds.value.has(configId)
}

/** 祖先层级深度，用于子项缩进 */
function depthOf(config: DirectConfig): number {
  let depth = 0
  let current = config
  const seen = new Set<string>()
  while (current.ref_id && !seen.has(current.id)) {
    seen.add(current.id)
    const parent = configMap.value.get(current.ref_id)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

/** 祖先里只要有被折叠的分组，本行就不渲染 */
function isHiddenByCollapse(config: DirectConfig): boolean {
  let current = config
  const seen = new Set<string>()
  while (current.ref_id && !seen.has(current.id)) {
    seen.add(current.id)
    if (collapsedGroups.value[current.ref_id]) return true
    const parent = configMap.value.get(current.ref_id)
    if (!parent) break
    current = parent
  }
  return false
}

function isExpanded(configId: string): boolean {
  return !collapsedGroups.value[configId]
}

function toggleGroup(configId: string) {
  const next = { ...collapsedGroups.value }
  if (next[configId]) delete next[configId]
  else next[configId] = true
  collapsedGroups.value = next
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
  } catch {
    // 存储不可用（隐私模式等）时仅本次会话生效
  }
}

/** 实际渲染的行：可见配置去掉被折叠分组里的项 */
const renderConfigs = computed(() => visibleConfigs.value.filter((c) => !isHiddenByCollapse(c)))
</script>

<template>
  <div class="control-panel">
    <div v-if="visibleConfigs.length === 0" class="empty-hint">暂无可用控制项</div>

    <TransitionGroup name="control-list" tag="div">
      <div
        v-for="config in renderConfigs"
        :key="config.id"
        class="control-row"
        :class="{ 'is-child': depthOf(config) > 0 }"
        :style="{ '--depth': depthOf(config) }"
      >
        <!-- 挂了子配置的项：左侧箭头折叠/展开子配置（无子项时占位，保证控件对齐） -->
        <button
          v-if="hasChildren(config.id)"
          class="group-toggle"
          :title="isExpanded(config.id) ? '收起子配置' : '展开子配置'"
          @click.stop="toggleGroup(config.id)"
        >
          <el-icon>
            <ArrowDown v-if="isExpanded(config.id)" />
            <ArrowRight v-else />
          </el-icon>
        </button>
        <span v-else class="group-toggle group-toggle-placeholder" aria-hidden="true" />

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

        <!-- 单选框类型（f_type=5），渲染为下拉选择 -->
        <div v-else-if="config.f_type === '5'" class="control-select">
          <span class="input-label">{{ config.t_name }}</span>
          <ElSelect
            :model-value="getDirectValue(config.id, config.default_value) || ''"
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

        <!-- 滑动条类型 -->
        <ControlSlider
          v-else-if="config.f_type === '3'"
          :label="config.t_name"
          :model-value="getSliderValue(config)"
          :min="config.min ? parseFloat(config.min) : 0"
          :max="config.max ? parseFloat(config.max) : 100"
          :step="getSliderStep(config)"
          @change="(v: number) => handleInputChange(config, String(v))"
        />

        <!-- 输入框类型（阈值设置） -->
        <div v-else-if="config.f_type === '2'" class="control-input">
          <span class="input-label">{{ config.t_name }}</span>
          <input
            class="threshold-input"
            type="number"
            :value="getDirectValue(config.id, config.default_value) || ''"
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
      </div>
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

/* 一行配置：左侧折叠箭头 + 控件（子项按层级缩进） */
.control-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: calc(var(--depth, 0) * 12px);
}

/* 控件占满剩余宽度；箭头固定宽度不参与拉伸 */
.control-row > *:not(.group-toggle) {
  flex: 1;
  min-width: 0;
}

/* 子项左侧竖线，直观看出归属关系 */
.control-row.is-child {
  border-left: 2px solid #e4e7ed;
}

.group-toggle {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #909399;
  font-size: 12px;
  cursor: pointer;
}

/* 无子配置时的占位：不响应鼠标，仅占宽度保证控件对齐 */
.group-toggle-placeholder {
  cursor: default;
  pointer-events: none;
}

.group-toggle:hover {
  background: #f0f2f5;
  color: #409eff;
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
