<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElTabs, ElTabPane } from 'element-plus'
import { getData, getDataMapper } from '../server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { Data, FieldMapper } from '@/server/types'
import type { DbName } from '@/server/types'

const { latestSensorData } = useWebSocket()

const latestRecord = ref<Data | null>(null)
const recentRecords = ref<Data[]>([])
const fieldMappers = ref<FieldMapper[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 当前追踪的设备编号
const trackedDevice = ref<string | null>(null)

const activeTable = ref<'temp' | 'humi' | 'light'>('temp')

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

    const data = await getData('data', {
      limit: 6,
      offset: 0,
      order_table: 'id',
      desc: true,
      where: {},
    })
    const latestData = data[0]
    if (latestData) {
      latestRecord.value = latestData
      recentRecords.value = data.slice(0, 6)
      trackedDevice.value = latestData.d_no
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取数据失败'
  } finally {
    loading.value = false
  }
}

// 监听 WebSocket 实时数据，更新 latestRecord
watch(
  () => (trackedDevice.value ? latestSensorData.value.get(trackedDevice.value) : undefined),
  (wsData) => {
    if (wsData && trackedDevice.value) {
      // 用 WebSocket 数据构造一个新的 Data 记录用于显示
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

onMounted(() => {
  loadData()
})

watch(activeTable, () => {
  loadData()
})

const sortedMappers = computed(() =>
  fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id),
)
</script>

<template>
  <div class="mobile-terminal">
    <div class="mobile-header">
      <h2>📱 移动端监控</h2>
      <span v-if="latestRecord" class="update-time">{{ latestRecord.c_time }}</span>
    </div>

    <!-- 数据类型 Tab（已禁用，恢复时去掉 v-if="false"） -->
    <ElTabs v-if="false" v-model="activeTable" size="small">
      <ElTabPane label="温度" name="temp" />
      <ElTabPane label="湿度" name="humi" />
      <ElTabPane label="光照" name="light" />
    </ElTabs>

    <div v-if="error" class="error-state">{{ error }}</div>

    <!-- 实时数据卡片 -->
    <div class="snapshot-card" v-loading="loading">
      <div v-if="!latestRecord && !loading" class="empty-state">暂无数据</div>
      <template v-else-if="latestRecord">
        <div class="device-bar">
          <span class="device-label">设备</span>
          <span class="device-no">{{ latestRecord.d_no || '--' }}</span>
        </div>
        <div class="sensor-grid">
          <div v-for="m in sortedMappers" :key="m.db_name" class="mobile-sensor-item">
            <span class="ms-label">{{ m.f_name }}</span>
            <span class="ms-value">{{ fieldValue(latestRecord, m.db_name) }}{{ m.unit }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- 最近数据列表 -->
    <div class="recent-section">
      <h3>最近记录</h3>
      <div v-if="recentRecords.length === 0" class="empty-state">暂无数据</div>
      <div v-else class="recent-list">
        <div v-for="(rec, idx) in recentRecords" :key="rec.id" class="recent-item">
          <div class="recent-item-header">
            <span class="recent-idx">#{{ recentRecords.length - idx }}</span>
            <span class="recent-time">{{ rec.c_time }}</span>
          </div>
          <div class="recent-item-body">
            <span v-for="m in sortedMappers" :key="m.db_name" class="recent-field">
              {{ m.f_name }}: {{ fieldValue(rec, m.db_name) }}{{ m.unit }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-terminal {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow-y: auto;
  background: #f0f2f5;
}

.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
}

.mobile-header h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.update-time {
  font-size: 12px;
  color: #909399;
}

.snapshot-card {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  padding: 16px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.device-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.device-label {
  font-size: 13px;
  opacity: 0.8;
}

.device-no {
  font-size: 16px;
  font-weight: 700;
}

.sensor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mobile-sensor-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 10px;
  backdrop-filter: blur(4px);
}

.ms-label {
  font-size: 11px;
  opacity: 0.75;
}

.ms-value {
  font-size: 22px;
  font-weight: 700;
}

.recent-section h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #303133;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-item {
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.recent-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.recent-idx {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
}

.recent-time {
  font-size: 11px;
  color: #909399;
}

.recent-item-body {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}

.recent-field {
  font-size: 13px;
  color: #606266;
}

.empty-state,
.error-state {
  text-align: center;
  padding: 32px 0;
  color: #909399;
}

.error-state {
  color: #f56c6c;
}
</style>
