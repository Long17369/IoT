<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElTag, ElTabs, ElTabPane, ElSelect, ElOption } from 'element-plus'
import { getData, getDataMapper, getDevice } from '../server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { Data, FieldMapper, Device, DbName } from '@/server/types'

const latestRecord = ref<Data | null>(null)
const fieldMappers = ref<FieldMapper[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// WebSocket 实时告警 + 传感器数据
const { alarms, latestSensorData } = useWebSocket()

// 设备选择
const devices = ref<Device[]>([])
const selectedDevice = ref('')

// 数据类型 tab
const activeTable = ref<'temp' | 'humi' | 'light'>('temp')

// 真实告警状态（从 WebSocket alarms 派生）
const hasAlarm = computed(() => {
  if (!selectedDevice.value) return false
  return alarms.value.some((a) => a.d_no === selectedDevice.value)
})

function fieldValue(rec: Data | null, dbName: DbName): string {
  if (!rec) return '--'
  const raw = rec[dbName]
  if (raw === null || raw === undefined) return '--'
  return String(raw)
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const mappers = await getDataMapper('data')
    fieldMappers.value = mappers

    const where: Record<string, unknown> = {}
    if (selectedDevice.value) {
      where.d_no = { value: selectedDevice.value, operator: '=' }
    }

    const data = await getData('data', {
      limit: 1,
      offset: 0,
      order_table: 'id',
      desc: true,
      where: {},
    })
    const latestData = data[0]
    if (latestData) {
      latestRecord.value = latestData
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取数据失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const devList = await getDevice()
    devices.value = devList
    if (devList.length > 0) {
      selectedDevice.value = devList[0]?.number || devList[0]?.device_name || ''
    }
  } catch (e) {
    console.error('获取设备列表失败:', e)
  }
  loadData()
})

// 切换 tab 或设备时重新加载
watch([activeTable, selectedDevice], () => {
  loadData()
})

// 监听 WebSocket 实时数据，更新 latestRecord
watch(
  () => (selectedDevice.value ? latestSensorData.value.get(selectedDevice.value) : undefined),
  (wsData) => {
    if (wsData && selectedDevice.value) {
      latestRecord.value = {
        id: latestRecord.value?.id ?? 0,
        d_no: wsData.d_no,
        field1: wsData.temp,
        field2: wsData.humi,
        field3: wsData.light,
        field4: null,
        field5: null,
        field6: null,
        field7: null,
        field8: null,
        field9: null,
        field10: null,
        c_time: wsData.timestamp,
        online: '实时数据',
      }
    }
  },
)

const sortedMappers = computed(() =>
  fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id),
)
</script>

<template>
  <div class="local-display" :class="{ 'alarm-active': hasAlarm }">
    <div class="ld-header">
      <h1>📟 本地设备显示</h1>
      <div class="device-select">
        <ElSelect v-model="selectedDevice" placeholder="选择设备" size="small" style="width: 160px">
          <ElOption
            v-for="d in devices"
            :key="d.number || d.device_name"
            :label="`${d.device_name} (${d.number || d.device_name})`"
            :value="d.number || d.device_name"
          />
        </ElSelect>
      </div>
      <ElTag :type="hasAlarm ? 'danger' : 'success'" size="large">
        {{ hasAlarm ? '⚠ 故障' : '✓ 正常' }}
      </ElTag>
    </div>

    <!-- 数据类型 Tab（已禁用，恢复时去掉 v-if="false"） -->
    <ElTabs v-if="false" v-model="activeTable" size="small" style="width: 100%">
      <ElTabPane label="温度(内)" name="temp" />
      <ElTabPane label="温度(外)" name="humi" />
      <ElTabPane label="光照" name="light" />
    </ElTabs>

    <div v-if="error" class="ld-error">{{ error }}</div>

    <div v-if="!latestRecord && !loading" class="ld-empty">等待数据...</div>

    <div v-else-if="latestRecord" class="ld-content">
      <!-- 设备信息 -->
      <div class="ld-device-bar">
        <span class="ld-device-label">设备编号</span>
        <span class="ld-device-value">{{ latestRecord.d_no || '--' }}</span>
      </div>

      <!-- 传感器大数字读数 -->
      <div class="ld-readings">
        <div v-for="m in sortedMappers" :key="m.db_name" class="ld-reading-item">
          <span class="ld-reading-label">{{ m.f_name }}</span>
          <span class="ld-reading-value">
            {{ fieldValue(latestRecord, m.db_name) }}
            <small>{{ m.unit }}</small>
          </span>
        </div>
      </div>

      <!-- 报警指示灯 -->
      <div class="ld-alarm-indicator" :class="{ active: hasAlarm }">
        <div class="ld-alarm-dot" />
        <span>{{ hasAlarm ? '故障报警中' : '系统正常' }}</span>
      </div>

      <div class="ld-time">{{ latestRecord.c_time }}</div>
    </div>
  </div>
</template>

<style scoped>
.local-display {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px;
  background: #0a0e27;
  color: #e0e6ff;
  font-family: 'Courier New', monospace;
  transition: background 0.5s;
}

.local-display.alarm-active {
  background: #1a0000;
  animation: alarm-bg 1s infinite;
}

@keyframes alarm-bg {
  0%,
  100% {
    background: #0a0e27;
  }
  50% {
    background: #1a0000;
  }
}

.ld-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ld-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #7c8aff;
}

.ld-error {
  color: #f56c6c;
  font-size: 18px;
}

.ld-empty {
  font-size: 24px;
  color: #555;
}

.ld-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 600px;
}

.ld-device-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 24px;
  background: rgba(124, 138, 255, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(124, 138, 255, 0.3);
}

.ld-device-label {
  font-size: 14px;
  color: #8e99a4;
}

.ld-device-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.ld-readings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}

.ld-reading-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px;
  background: rgba(124, 138, 255, 0.08);
  border-radius: 16px;
  border: 2px solid rgba(124, 138, 255, 0.2);
}

.ld-reading-label {
  font-size: 14px;
  color: #8e99a4;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.ld-reading-value {
  font-size: 42px;
  font-weight: 700;
  color: #00ff88;
  line-height: 1;
}

.ld-reading-value small {
  font-size: 18px;
  font-weight: 400;
  color: #8e99a4;
}

.ld-alarm-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  border-radius: 8px;
  background: rgba(103, 194, 58, 0.1);
  border: 1px solid rgba(103, 194, 58, 0.3);
  font-size: 16px;
  color: #67c23a;
}

.ld-alarm-indicator.active {
  background: rgba(245, 108, 108, 0.15);
  border-color: rgba(245, 108, 108, 0.4);
  color: #f56c6c;
}

.ld-alarm-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #67c23a;
  box-shadow: 0 0 8px #67c23a;
}

.ld-alarm-indicator.active .ld-alarm-dot {
  background: #f56c6c;
  box-shadow: 0 0 12px #f56c6c;
  animation: blink-dot 0.6s infinite;
}

@keyframes blink-dot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.ld-time {
  font-size: 14px;
  color: #555;
}
</style>
