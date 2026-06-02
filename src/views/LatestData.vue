<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Watch, TrendCharts } from '@element-plus/icons-vue'
import { ElIcon, ElSelect, ElOption, ElTabs, ElTabPane } from 'element-plus'
import DataCard from '../component/data/DataCard.vue'
import DataChart from '../component/data/DataChart.vue'
import { getData, getDataMapper, getDevice } from '@/server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { Data, FieldMapper, Device, Where } from '@/server/types'
import type { CardField, ColumnDef } from '@/types/dataType'

const latestRecord = ref<Data | null>(null)
const recentRecords = ref<Data[]>([])
const fieldMappers = ref<FieldMapper[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// WebSocket 实时数据
const { getDeviceOnline, latestSensorData } = useWebSocket()

// 设备选择
const devices = ref<Device[]>([])
const selectedDevice = ref('')

// 数据类型 tab
const activeTable = ref<'temp' | 'humi' | 'light'>('temp')

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
  await loadMappers()
  loadHistoryData()
})
const cardFields = computed<CardField[]>(() => {
  const fields: CardField[] = [
    { key: 'd_no', label: '设备编号', section: 'header', tag: false },
    { key: 'c_time', label: '更新时间', section: 'footer' },
  ]

  const sorted = fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id)

  for (const m of sorted) {
    fields.push({
      key: m.db_name,
      label: m.f_name,
      unit: m.unit || undefined,
      section: 'body',
      tag: true,
      statusMap: {
        statusMap: '',
      },
    })
  }
  return fields
})

// 从 FieldMapper 生成图表列
const chartColumns = computed<ColumnDef[]>(() => {
  const cols: ColumnDef[] = [{ key: 'c_time', label: '时间', chartable: false }]
  const sorted = fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id)
  for (const m of sorted) {
    // 光照的补光开始/结束是时间字符串，不应放入图表
    const isTimeField =
      activeTable.value === 'light' && (m.db_name === 'field3' || m.db_name === 'field4')
    cols.push({
      key: m.db_name,
      label: m.f_name,
      unit: m.unit || undefined,
      chartable: !isTimeField,
    })
  }
  return cols
})

async function loadMappers() {
  try {
    fieldMappers.value = await getDataMapper('data')
  } catch (err) {
    console.error('获取字段映射失败:', err)
  }
}

async function loadHistoryData() {
  loading.value = true
  error.value = null
  try {
    const where: Where = {}
    if (selectedDevice.value) {
      where.d_no = { value: selectedDevice.value, operator: '=' }
    }

    const data = await getData('data', {
      limit: 10,
      offset: 0,
      order_table: 'id',
      desc: true,
      where,
    })
    if (data.length > 0) {
      latestRecord.value = data[0] ?? null
      recentRecords.value = [...data].reverse()
    } else {
      latestRecord.value = null
      recentRecords.value = []
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取数据失败'
  } finally {
    loading.value = false
  }
}

// 切换设备或数据类型时重新加载
watch([selectedDevice, activeTable], async () => {
  // 切换时先清空旧数据，避免图表用旧数据渲染新配置导致 ECharts 报错
  latestRecord.value = null
  recentRecords.value = []
  await loadMappers()
  loadHistoryData()
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
</script>

<template>
  <div class="latest-data">
    <!-- 设备选择器 -->
    <div class="device-bar">
      <span class="device-label">监控设备：</span>
      <ElSelect v-model="selectedDevice" placeholder="选择设备" size="default" style="width: 200px">
        <ElOption
          v-for="d in devices"
          :key="d.number || d.device_name"
          :label="`${d.device_name} (${d.number || d.device_name})`"
          :value="d.number || d.device_name"
        />
      </ElSelect>
      <span
        v-if="selectedDevice"
        class="online-badge"
        :class="getDeviceOnline(selectedDevice) ? 'online' : 'offline'"
      >
        {{ getDeviceOnline(selectedDevice) ? '在线' : '离线' }}
      </span>
    </div>

    <!-- 数据类型 Tab（已禁用，恢复时去掉 v-if="false"） -->
    <ElTabs v-if="false" v-model="activeTable">
      <ElTabPane label="🌡 温度" name="temp" />
      <ElTabPane label="💧 湿度" name="humi" />
      <ElTabPane label="☀ 光照" name="light" />
    </ElTabs>

    <div class="card-section">
      <h3>
        <ElIcon><Watch /></ElIcon>
        最新数据
      </h3>
      <div v-if="error" class="error-state">{{ error }}</div>
      <div v-else-if="!latestRecord && !loading" class="empty-state">暂无数据</div>
      <DataCard
        v-else-if="latestRecord"
        :data="latestRecord as Record<string, unknown>"
        :fields="cardFields"
      />
    </div>
    <div class="chart-section">
      <h3>
        <ElIcon><TrendCharts /></ElIcon>
        最近10条数据趋势
      </h3>
      <div v-if="recentRecords.length === 0" class="empty-state">暂无数据</div>
      <div v-else class="chart-container">
        <DataChart
          :data="recentRecords as Record<string, unknown>[]"
          :columns="chartColumns"
          mode="line"
          x-axis-key="c_time"
          :dual-y-axis="true"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.latest-data {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
}

.device-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.device-label {
  font-size: 14px;
  color: #606266;
}

.online-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.online-badge.online {
  background: #e1f3d8;
  color: #67c23a;
}

.online-badge.offline {
  background: #fef0f0;
  color: #f56c6c;
}

.card-section,
.chart-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.latest-data h3 {
  margin: 0;
  font-size: 20px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-container {
  width: 100%;
  max-width: 900px;
  height: 450px;
  min-height: 450px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 16px;
  position: relative;
}

.empty-state,
.error-state {
  padding: 32px 0;
  color: #909399;
}

.error-state {
  color: #f56c6c;
}
</style>
