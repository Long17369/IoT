<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { ElSelect, ElOption, ElMessage } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import ControlPanel from '@/component/control/ControlPanel.vue'
import {
  getDataDevices,
  fetchDirectConfig,
  fetchDirectData,
  sendControlCommand,
  resetDeviceBlock,
} from '@/server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { DirectConfig, Direct } from '@/server/types'

/** 手动控制对象/动作（POST /api/control 的 target / action） */
type ControlTarget = 'heat' | 'water'
type ControlAction = 'on' | 'off'

const { clearDeviceAlarms, directUpdates, isDeviceLocked, describeDeviceLock } = useWebSocket()

const devices = ref<string[]>([])
const selectedDevice = ref('')
const configs = ref<DirectConfig[]>([])
const directValues = ref<Direct[]>([])
const loading = ref(false)
const sending = ref(false)

/**
 * 设备是否处于保护锁定（复位按钮的显示条件）。
 * 完全由后端 WS `lock` 事件驱动（locked/active 由后端 device_locks 决定）。
 */
const isLocked = computed(() => !!selectedDevice.value && isDeviceLocked(selectedDevice.value))
/** 当前锁的可读描述，如 '堵塞（压力归零）' */
const lockText = computed(() =>
  selectedDevice.value ? describeDeviceLock(selectedDevice.value) : '',
)

onMounted(async () => {
  try {
    devices.value = await getDataDevices()
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0] ?? ''
      await loadDeviceConfig()
    }
  } catch (e) {
    console.error('获取设备列表失败:', e)
  }
})

async function loadDeviceConfig() {
  if (!selectedDevice.value) return
  loading.value = true
  try {
    const [cfg, values] = await Promise.all([
      fetchDirectConfig(),
      fetchDirectData(selectedDevice.value),
    ])
    configs.value = cfg
    directValues.value = values
  } catch (e) {
    console.error('获取控制配置失败:', e)
  } finally {
    loading.value = false
  }
}

async function onDeviceChange() {
  await loadDeviceConfig()
}

async function sendCommand(target: ControlTarget, action: ControlAction) {
  sending.value = true
  try {
    if (!selectedDevice.value) return
    await sendControlCommand(target, action, selectedDevice.value)
    console.log(`控制指令已下发: ${target}.${action}`)
  } catch (e) {
    console.error('下发控制指令失败:', e)
  } finally {
    sending.value = false
  }
}

/** 复位：释放后端保护锁 + 按快照恢复运行（锁状态由 WS lock 事件回推，不在这里改本地状态） */
async function onResetLock() {
  if (!selectedDevice.value) return
  sending.value = true
  try {
    await resetDeviceBlock(selectedDevice.value)
    clearDeviceAlarms(selectedDevice.value) // 本地兜底清除横幅（WS reset 也会触发）
    await onControlUpdated()
    console.log('保护锁已复位:', selectedDevice.value)
  } catch (e) {
    console.error('复位失败:', e)
  } finally {
    sending.value = false
  }
}

async function onControlUpdated() {
  // 控制指令下发后，刷新指令值和配置（ref_id 过滤可能变化）
  try {
    const [values, cfg] = await Promise.all([
      fetchDirectData(selectedDevice.value),
      fetchDirectConfig(),
    ])
    directValues.value = values
    configs.value = cfg
  } catch (e) {
    console.error('刷新指令数据失败:', e)
  }
}

// 服务端数据修改通知（WS direct 事件）：自动控制/设备端/其他端口发起的配置变更实时同步到面板
// 成功 → 防抖刷新配置页；失败 → ElMessage 错误提示（只汇报不处理）
let refreshTimer: ReturnType<typeof setTimeout> | null = null
function debouncedRefresh(delay = 200) {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    onControlUpdated()
  }, delay)
}

// directUpdates 采用"追加到尾部"（见 useWebSocket），最新一条是最后一项
watch(
  () => directUpdates.value[directUpdates.value.length - 1],
  (update) => {
    if (!update) return
    // 修改失败：错误提示（只汇报不处理）
    if (update.success === false) {
      ElMessage.error(update.error ?? '指令下发失败')
      return
    }
    // 仅同步当前选中设备的变更
    if (update.d_no && selectedDevice.value && update.d_no !== selectedDevice.value) return
    debouncedRefresh()
  },
)

onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<template>
  <div class="storage-control">
    <!-- 顶部工具栏 -->
    <div class="control-toolbar">
      <h2>
        <el-icon><Setting /></el-icon>
        系统控制
      </h2>
      <div class="device-selector">
        <span>控制设备：</span>
        <ElSelect
          v-model="selectedDevice"
          placeholder="选择设备"
          size="default"
          style="width: 200px"
          @change="onDeviceChange"
        >
          <ElOption v-for="d in devices" :key="d" :label="d" :value="d" />
        </ElSelect>
      </div>
    </div>

    <div v-if="!selectedDevice" class="empty-hint">请先选择要控制的设备</div>

    <template v-else>
      <!-- 快捷控制（command.ts 新协议） -->
      <div class="quick-control">
        <h3>快捷控制</h3>
        <div class="quick-btns">
          <el-button type="warning" :disabled="sending" @click="sendCommand('heat', 'on')">
            加热开
          </el-button>
          <el-button type="info" :disabled="sending" @click="sendCommand('heat', 'off')">
            加热关
          </el-button>
          <el-button type="primary" :disabled="sending" @click="sendCommand('water', 'on')">
            水泵开
          </el-button>
          <el-button type="danger" :disabled="sending" @click="sendCommand('water', 'off')">
            水泵关
          </el-button>
          <!-- 复位：设备被保护锁定时显示（由 WS lock 事件驱动），释放锁并按快照恢复 -->
          <el-button v-if="isLocked" type="success" :disabled="sending" @click="onResetLock">
            复位
          </el-button>
          <span v-if="isLocked && lockText" class="lock-hint">已锁定：{{ lockText }}</span>
        </div>
      </div>

      <div class="control-panel-wrapper">
        <h3>控制面板（参数配置）</h3>
        <div v-if="loading" class="loading-hint">加载中...</div>
        <ControlPanel
          v-else
          :configs="configs"
          :direct-values="directValues"
          :d-no="selectedDevice"
          :disabled="false"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.storage-control {
  height: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.control-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.control-toolbar h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.control-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  min-height: 0;
}

@media (max-width: 768px) {
  .control-layout {
    grid-template-columns: 1fr;
  }
}

.sensor-panel,
.control-panel-wrapper {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.sensor-panel h3,
.control-panel-wrapper h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sensor-readings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.control-panel-wrapper > :deep(.control-panel) {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.empty-hint,
.loading-hint {
  text-align: center;
  color: #909399;
  padding: 60px 0;
  font-size: 14px;
}

.offline-hint {
  margin-top: 16px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  color: #f56c6c;
  font-size: 13px;
  text-align: center;
}

/* 锁定提示：跟着 WS lock 事件显示当前锁类型/原因 */
.lock-hint {
  margin-left: 8px;
  font-size: 13px;
  color: #e6a23c;
}
</style>
