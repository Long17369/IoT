<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElSelect, ElOption } from 'element-plus'
import { Setting, Monitor } from '@element-plus/icons-vue'
import StatusCard from '@/component/dashboard/StatusCard.vue'
import DeviceStatusTag from '@/component/dashboard/DeviceStatusTag.vue'
import ControlPanel from '@/component/control/ControlPanel.vue'
import { getDevice, fetchDirectConfig, fetchDirectData } from '@/server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { Device, DirectConfig, Direct } from '@/server/types'

const { getDeviceSensorData, getDeviceOnline } = useWebSocket()

const devices = ref<Device[]>([])
const selectedDevice = ref('')
const configs = ref<DirectConfig[]>([])
const directValues = ref<Direct[]>([])
const loading = ref(false)

onMounted(async () => {
  try {
    devices.value = await getDevice()
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0]?.device_name || devices.value[0]?.number || ''
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

const currentDevice = computed(() =>
  devices.value.find((d) => (d.number || d.device_name) === selectedDevice.value),
)

const sensorData = computed(() => {
  if (!selectedDevice.value) return undefined
  return getDeviceSensorData(selectedDevice.value)
})

const deviceOnline = computed(() => {
  if (!selectedDevice.value) return false
  return getDeviceOnline(selectedDevice.value)
})

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
          <ElOption
            v-for="d in devices"
            :key="d.number || d.device_name"
            :label="`${d.device_name} (${d.number || d.device_name})`"
            :value="d.number || d.device_name"
          />
        </ElSelect>
      </div>
    </div>

    <div v-if="!selectedDevice" class="empty-hint">请先选择要控制的设备</div>

    <template v-else>
      <!-- 设备状态 -->
      <DeviceStatusTag
        :online="deviceOnline"
        :device-name="currentDevice?.device_name ?? ''"
        :device-number="currentDevice?.number ?? ''"
      />

      <!-- 主内容区：左右布局 -->
      <div class="control-layout">
        <!-- 左侧：传感器实时读数 -->
        <div class="sensor-panel">
          <h3>
            <el-icon><Monitor /></el-icon>
            实时读数
          </h3>
          <div class="sensor-readings">
            <StatusCard
              title="温度(内)"
              :value="sensorData?.temp ?? '--'"
              unit="°C"
              :status="'normal'"
            />
            <StatusCard
              title="温度(外)"
              :value="sensorData?.humi ?? '--'"
              unit="%"
              :status="'normal'"
            />
            <StatusCard
              title="光照"
              :value="sensorData?.light ?? '--'"
              unit="lux"
              :status="'normal'"
            />
          </div>
        </div>

        <!-- 右侧：控制面板 -->
        <div class="control-panel-wrapper">
          <h3>控制面板</h3>
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
