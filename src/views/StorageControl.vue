<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElSelect, ElOption } from 'element-plus'
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
import type { DirectConfig, Direct, ControlTarget, ControlAction } from '@/server/types'

const { clearDeviceAlarms } = useWebSocket()

const devices = ref<string[]>([])
const selectedDevice = ref('')
const configs = ref<DirectConfig[]>([])
const directValues = ref<Direct[]>([])
const loading = ref(false)
const sending = ref(false)

/** 设备是否处于堵塞状态（t_direct 存在 blocked=1） */
const isBlocked = computed(() =>
  directValues.value.some((d) => d.config_id === 'blocked' && d.value === '1'),
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

/** 手动复位堵塞状态：清除持久化标记 + 本地预警横幅 + 刷新面板 */
async function onResetBlock() {
  if (!selectedDevice.value) return
  sending.value = true
  try {
    await resetDeviceBlock(selectedDevice.value)
    clearDeviceAlarms(selectedDevice.value) // 本地兜底清除横幅（WS reset 也会触发）
    await onControlUpdated() // 刷新后 blocked 变 '0'，复位按钮消失
    console.log('堵塞状态已复位:', selectedDevice.value)
  } catch (e) {
    console.error('复位堵塞状态失败:', e)
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
</script>

<template>
  <div class="storage-control">
    <!-- 顶部工具栏 -->
    <div class="control-toolbar">
      <h2>
        <el-icon><Setting /></el-icon>
        储运舱控制
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
          <!-- 手动复位：仅设备堵塞时显示，清除堵塞状态与预警 -->
          <el-button v-if="isBlocked" type="success" :disabled="sending" @click="onResetBlock">
            复位
          </el-button>
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
          @updated="onControlUpdated"
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
</style>
