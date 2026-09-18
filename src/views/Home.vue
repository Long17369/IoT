<script setup lang="ts">
defineOptions({ name: 'HomePage' })
import { ref, computed, onMounted } from 'vue'
import { ElSelect, ElOption, ElTag } from 'element-plus'
import StatusCard from '@/component/dashboard/StatusCard.vue'
import { getDataDevices, getDataMapper } from '@/server/api'
import type { FieldMapper } from '@/server/types'
import { useWebSocket } from '@/composables/useWebSocket'
import { fmtServerTime } from '@/utils/format'

const { getDeviceSensorData, isOffline } = useWebSocket()

const devices = ref<string[]>([])
const selectedDevice = ref('')
const fieldMappers = ref<FieldMapper[]>([])

onMounted(async () => {
  try {
    devices.value = await getDataDevices()
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0] ?? ''
    }
  } catch (e) {
    console.error('获取设备列表失败:', e)
  }
  try {
    fieldMappers.value = await getDataMapper('sensor')
  } catch (e) {
    console.error('获取字段映射失败:', e)
  }
})

/** 显示名：优先取 t_field_mapper 的 f_name（不硬编码），缺失回退 */
function label(db: string, fallback: string): string {
  return fieldMappers.value.find((m) => m.db_name === db)?.f_name || fallback
}

const sensorData = computed(() => {
  if (!selectedDevice.value) return undefined
  return getDeviceSensorData(selectedDevice.value)
})
</script>

<template>
  <div class="dashboard">
    <!-- 顶部工具栏 -->
    <div class="dashboard-toolbar">
      <h2>📊 水循环状态总览</h2>
      <div class="device-selector">
        <span>当前设备：</span>
        <ElSelect
          v-model="selectedDevice"
          placeholder="选择设备"
          size="default"
          style="width: 200px"
        >
          <ElOption v-for="d in devices" :key="d" :label="d" :value="d" />
        </ElSelect>
        <ElTag
          v-if="selectedDevice && isOffline(selectedDevice)"
          type="danger"
          effect="dark"
          size="small"
        >
          📡 设备断开
        </ElTag>
      </div>
    </div>

    <!-- 传感器数据卡片 -->
    <div class="sensor-grid">
      <StatusCard
        :title="label('field1', '进水温度')"
        :value="sensorData?.wen_du1"
        unit="°C"
        empty-text="离线"
      />
      <StatusCard
        :title="label('field2', '出水温度')"
        :value="sensorData?.wen_du2"
        unit="°C"
        empty-text="离线"
      />
      <StatusCard title="加热速度" :value="sensorData?.heat_rate" unit="°C/min" empty-text="离线" />
      <StatusCard title="压力" :value="sensorData?.pressure" unit="kPa" empty-text="离线" />
      <StatusCard
        :title="label('field6', '瞬时流量')"
        :value="sensorData?.liu_liang2"
        unit="L/min"
        empty-text="离线"
      />
      <StatusCard title="平均水流" :value="sensorData?.avg_flow" unit="L/min" empty-text="离线" />
    </div>

    <!-- 当前设备信息 -->
    <div v-if="selectedDevice" class="device-detail">
      <div class="detail-card">
        <span class="detail-label">设备编号</span>
        <span class="detail-value">{{ selectedDevice }}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">数据更新时间</span>
        <span class="detail-value">{{ fmtServerTime(sensorData?.timestamp) || '--' }}</span>
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
