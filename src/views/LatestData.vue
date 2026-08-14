<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { Watch, TrendCharts } from '@element-plus/icons-vue'
import { ElIcon, ElSelect, ElOption } from 'element-plus'
import DataCard from '../component/data/DataCard.vue'
import DataChart from '../component/data/DataChart.vue'
import { getDataMapper, getDataDevices } from '@/server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import type { Data, FieldMapper, WsData } from '@/server/types'
import type { CardField, ColumnDef } from '@/types/dataType'

const fieldMappers = ref<FieldMapper[]>([])

// 图表展示最近 N 条实时数据（数据来自 WebSocket 后台缓存）
const MAX_CHART_POINTS = 10

// WebSocket 实时数据（模块级缓存：切页面不销毁，后台持续更新）
const { latestSensorData, recentRecords, isOffline } = useWebSocket()

// 设备选择（有数据上报的 d_no）
const devices = ref<string[]>([])
const selectedDevice = ref('')

// 最新一条数据：直接来自 WS 实时缓存（不再从数据库加载）
const latestRecord = computed<Data | null>(() => {
  if (!selectedDevice.value) return null
  const ws = latestSensorData.value.get(selectedDevice.value)
  return ws ? toDataRecord(ws) : null
})

// 图表数据：来自 WS 后台缓存的最近记录（切页面不销毁）
const chartRecords = computed<Data[]>(() => {
  if (!selectedDevice.value) return []
  const list = recentRecords.value.get(selectedDevice.value) ?? []
  return list.slice(-MAX_CHART_POINTS).map(toDataRecord)
})

onMounted(async () => {
  try {
    devices.value = await getDataDevices()
    if (devices.value.length > 0) {
      selectedDevice.value = devices.value[0] ?? ''
    }
  } catch (e) {
    console.error('获取设备列表失败:', e)
  }
  loadMappers()
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
    })
  }
  return fields
})

// 从 FieldMapper 生成图表列
const chartColumns = computed<ColumnDef[]>(() => {
  const cols: ColumnDef[] = [{ key: 'c_time', label: '时间', chartable: false }]
  const sorted = fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id)
  for (const m of sorted) {
    cols.push({
      key: m.db_name,
      label: m.f_name,
      unit: m.unit || undefined,
      chartable: m.chartable === '1',
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

// 切换设备时仅刷新字段映射（数据直接来自 WS 后台缓存，无需从数据库加载）
watch(selectedDevice, () => {
  loadMappers()
})

// 将 WS 实时数据转换为 Data 记录（最新卡片 + 趋势图共用）
function toDataRecord(wsData: WsData): Data {
  return {
    id: 0,
    d_no: wsData.d_no,
    field1: wsData.wen_du1,
    field2: wsData.wen_du2,
    field3: wsData.jia_re,
    field4: wsData.shui_beng,
    field5: wsData.liu_liang1,
    field6: wsData.liu_liang2,
    field7: wsData.ya_li,
    field8: null,
    field9: null,
    field10: null,
    c_time: wsData.timestamp,
  }
}
</script>

<template>
  <div class="latest-data">
    <!-- 设备选择器 -->
    <div class="device-bar">
      <span class="device-label">监控设备：</span>
      <ElSelect v-model="selectedDevice" placeholder="选择设备" size="default" style="width: 200px">
        <ElOption v-for="d in devices" :key="d" :label="d" :value="d" />
      </ElSelect>
    </div>

    <div class="card-section">
      <h3>
        <ElIcon><Watch /></ElIcon>
        最新数据
      </h3>
      <div v-if="!latestRecord" class="empty-state">暂无数据</div>
      <DataCard
        v-else
        :data="latestRecord as unknown as Record<string, unknown>"
        :fields="cardFields"
      >
        <template #header-right>
          <ElTag
            v-if="selectedDevice && isOffline(selectedDevice)"
            type="danger"
            effect="dark"
            size="small"
          >
            📡 设备断开
          </ElTag>
        </template>
      </DataCard>
    </div>
    <div class="chart-section">
      <h3>
        <ElIcon><TrendCharts /></ElIcon>
        最近10条数据趋势
      </h3>
      <div v-if="chartRecords.length === 0" class="empty-state">暂无数据</div>
      <div v-else class="chart-container">
        <DataChart
          :data="chartRecords as unknown as Record<string, unknown>[]"
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
