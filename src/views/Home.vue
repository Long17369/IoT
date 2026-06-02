<script setup lang="ts">
defineOptions({ name: 'HomePage' })
import { ref, computed, onMounted } from 'vue'
import { ElSelect, ElOption } from 'element-plus'
import StatusCard from '@/component/dashboard/StatusCard.vue'
import DeviceStatusTag from '@/component/dashboard/DeviceStatusTag.vue'
import AlarmBanner from '@/component/alarm/AlarmBanner.vue'
import { getDevice } from '@/server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { Device } from '@/server/types'

const { getDeviceSensorData, getDeviceOnline, alarms, clearAlarms } = useWebSocket()

const devices = ref<Device[]>([])
const selectedDevice = ref('')

onMounted(async () => {
  try {
    devices.value = await getDevice()
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0]?.number ?? ''
    }
  } catch (e) {
    console.error('获取设备列表失败:', e)
  }
})

const currentDevice = computed(() => devices.value.find((d) => d.number === selectedDevice.value))

const sensorData = computed(() => {
  if (!selectedDevice.value) return undefined
  return getDeviceSensorData(selectedDevice.value)
})

const deviceOnline = computed(() => {
  if (!selectedDevice.value) return false
  return getDeviceOnline(selectedDevice.value)
})

function tempStatus(value: string): 'normal' | 'warning' | 'danger' {
  const v = parseFloat(value)
  if (isNaN(v)) return 'normal'
  if (v > 30 || v < 0) return 'danger'
  if (v > 25 || v < 5) return 'warning'
  return 'normal'
}

function humiStatus(value: string): 'normal' | 'warning' | 'danger' {
  const v = parseFloat(value)
  if (isNaN(v)) return 'normal'
  if (v > 90 || v < 20) return 'danger'
  if (v > 80 || v < 30) return 'warning'
  return 'normal'
}
</script>

<template>
  <div class="dashboard">
    <!-- 告警横幅 -->
    <AlarmBanner :alarms="alarms" @clear="clearAlarms" />

    <!-- 顶部工具栏 -->
    <div class="dashboard-toolbar">
      <h2>📊 储运车状态总览</h2>
      <div class="device-selector">
        <span>当前设备：</span>
        <ElSelect
          v-model="selectedDevice"
          placeholder="选择设备"
          size="default"
          style="width: 200px"
        >
          <ElOption
            v-for="d in devices"
            :key="d.number"
            :label="`${d.device_name} (${d.number})`"
            :value="d.number"
          />
        </ElSelect>
      </div>
    </div>

    <!-- 设备状态标签列表 -->
    <div class="device-list">
      <DeviceStatusTag
        v-for="d in devices"
        :key="d.number"
        :online="getDeviceOnline(d.number)"
        :device-name="d.device_name"
        :device-number="d.number"
      />
      <div v-if="devices.length === 0" class="empty-hint">暂无设备，请先添加设备</div>
    </div>

    <!-- 传感器数据卡片 -->
    <div class="sensor-grid">
      <StatusCard
        title="温度"
        :value="sensorData?.temp ?? '--'"
        unit="°C"
        :status="sensorData ? tempStatus(sensorData.temp) : 'normal'"
        :trend="'stable'"
      />
      <StatusCard
        title="湿度"
        :value="sensorData?.humi ?? '--'"
        unit="%"
        :status="sensorData ? humiStatus(sensorData.humi) : 'normal'"
        :trend="'stable'"
      />
      <StatusCard
        title="光照"
        :value="sensorData?.light ?? '--'"
        unit="lux"
        :status="'normal'"
        :trend="'stable'"
      />
    </div>

    <!-- 当前设备信息 -->
    <div v-if="currentDevice" class="device-detail">
      <div class="detail-card">
        <span class="detail-label">设备名称</span>
        <span class="detail-value">{{ currentDevice.device_name }}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">设备编号</span>
        <span class="detail-value">{{ currentDevice.number }}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">在线状态</span>
        <span class="detail-value" :class="deviceOnline ? 'online' : 'offline'">
          {{ deviceOnline ? '在线' : '离线' }}
        </span>
      </div>
      <div class="detail-card">
        <span class="detail-label">数据更新时间</span>
        <span class="detail-value">{{ sensorData?.timestamp ?? '--' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-toolbar h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

.device-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.device-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sensor-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .sensor-grid {
    grid-template-columns: 1fr;
  }
}

.device-detail {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .device-detail {
    grid-template-columns: repeat(2, 1fr);
  }
}

.detail-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-label {
  font-size: 12px;
  color: #909399;
}

.detail-value {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.detail-value.online {
  color: #67c23a;
}

.detail-value.offline {
  color: #f56c6c;
}

.empty-hint {
  color: #909399;
  font-size: 14px;
  padding: 16px 0;
}
</style>
