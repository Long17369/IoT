<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { ElTag, ElButton, ElIcon, ElTabs, ElTabPane } from 'element-plus'
import { Bell, WarningFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import { getData, getDataMapper } from '../server/api'
import { useWebSocket } from '@/composables/useWebSocket'
import DataChart from '../component/data/DataChart.vue'
import type { Data, FieldMapper } from '@/server/types'
import type { DbName } from '@/server/types'

const { latestSensorData } = useWebSocket()

// ========== 数据状态 ==========
const latestRecord = ref<Data | null>(null)
const recentRecords = ref<Data[]>([])
const fieldMappers = ref<FieldMapper[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 当前追踪的设备编号
const trackedDevice = ref<string | null>(null)

// 数据类型 tab
const activeTable = ref<'temp' | 'humi' | 'light'>('temp')

// ========== 报警状态 ==========
interface ManualAlarm {
  id: number
  msg: string
  time: string
  acknowledged: boolean
}

const manualAlarms = ref<ManualAlarm[]>([])
const alarmSoundEnabled = ref(true)
const alarmFlashActive = ref(false)
let flashInterval: ReturnType<typeof setInterval> | null = null
let alarmIdCounter = 0

const hasActiveAlarm = computed(() => manualAlarms.value.some((a) => !a.acknowledged))

function startFlash() {
  if (flashInterval) return
  alarmFlashActive.value = true
  flashInterval = setInterval(() => {
    alarmFlashActive.value = !alarmFlashActive.value
  }, 500)
}

function stopFlash() {
  if (flashInterval) {
    clearInterval(flashInterval)
    flashInterval = null
  }
  alarmFlashActive.value = false
}

function playBeep() {
  if (!alarmSoundEnabled.value) return
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = 'square'
    gain.gain.value = 0.1
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio not supported
  }
}

function triggerManualAlarm() {
  alarmIdCounter++
  const alarm: ManualAlarm = {
    id: alarmIdCounter,
    msg: `手动触发故障报警 #${alarmIdCounter}`,
    time: new Date().toLocaleString('zh-CN'),
    acknowledged: false,
  }
  manualAlarms.value.unshift(alarm)
  startFlash()
  playBeep()
}

function acknowledgeAlarm(id: number) {
  const alarm = manualAlarms.value.find((a) => a.id === id)
  if (alarm) alarm.acknowledged = true
  if (!hasActiveAlarm.value) stopFlash()
}

function acknowledgeAll() {
  manualAlarms.value.forEach((a) => (a.acknowledged = true))
  stopFlash()
}

function clearAlarms() {
  manualAlarms.value = []
  stopFlash()
}

// ========== 数据加载 ==========
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
      recentRecords.value = data.slice(0, 6).reverse()
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

// 切换 tab 重新加载
watch(activeTable, () => {
  loadData()
})

onBeforeUnmount(() => {
  stopFlash()
})

// ========== FieldMapper 辅助 ==========
function fieldValue(rec: Data | null, dbName: DbName): string {
  if (!rec) return '--'
  const raw = rec[dbName]
  if (raw === null || raw === undefined) return '--'
  return String(raw)
}

const chartColumns = computed(() => {
  const cols: import('../types/dataType').ColumnDef[] = [
    { key: 'c_time', label: '时间', chartable: false },
  ]
  const sorted = fieldMappers.value.filter((m) => m.visible === '1').sort((a, b) => a.id - b.id)
  for (const m of sorted) {
    cols.push({
      key: m.db_name,
      label: m.f_name,
      unit: m.unit || undefined,
      chartable: true,
    })
  }
  return cols
})
</script>

<template>
  <div class="web-terminal" :class="{ 'alarm-flash': alarmFlashActive && hasActiveAlarm }">
    <!-- 顶部报警条 -->
    <div v-if="hasActiveAlarm" class="alarm-banner">
      <ElIcon class="alarm-icon"><WarningFilled /></ElIcon>
      <span class="alarm-text"
        >⚠ 故障报警！当前有 {{ manualAlarms.filter((a) => !a.acknowledged).length }} 条未确认</span
      >
      <ElButton size="small" type="danger" plain @click="acknowledgeAll">全部确认</ElButton>
      <ElButton size="small" text @click="clearAlarms">清除</ElButton>
    </div>

    <div class="terminal-grid">
      <!-- 左侧：最新数据卡片 -->
      <div class="card-panel" v-loading="loading">
        <h3>📡 实时数据监控</h3>
        <!-- 数据类型 Tab（已禁用，恢复时去掉 v-if="false"） -->
        <ElTabs v-if="false" v-model="activeTable" size="small">
          <ElTabPane label="温度" name="temp" />
          <ElTabPane label="湿度" name="humi" />
          <ElTabPane label="光照" name="light" />
        </ElTabs>
        <div v-if="error" class="error-state">{{ error }}</div>
        <div v-else-if="!latestRecord" class="empty-state">暂无数据</div>
        <div v-else class="sensor-card">
          <div class="card-header">
            <ElTag type="success" size="small">设备：{{ latestRecord.d_no || '--' }}</ElTag>
            <span class="card-time">{{ latestRecord.c_time }}</span>
          </div>
          <div class="card-body-grid">
            <div
              v-for="m in fieldMappers
                .filter((fm) => fm.visible === '1')
                .sort((a, b) => a.id - b.id)"
              :key="m.db_name"
              class="sensor-item"
            >
              <span class="sensor-label">{{ m.f_name }}</span>
              <span class="sensor-value">
                {{ fieldValue(latestRecord, m.db_name) }}{{ m.unit }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：报警面板 -->
      <div class="alarm-panel">
        <div class="alarm-panel-header">
          <h3>
            <ElIcon><Bell /></ElIcon>
            故障报警
          </h3>
          <div class="alarm-controls">
            <ElButton size="small" type="danger" @click="triggerManualAlarm">
              手动触发报警
            </ElButton>
            <ElButton
              size="small"
              :type="alarmSoundEnabled ? 'warning' : 'info'"
              plain
              @click="alarmSoundEnabled = !alarmSoundEnabled"
            >
              {{ alarmSoundEnabled ? '🔊 声音开' : '🔇 声音关' }}
            </ElButton>
          </div>
        </div>
        <div class="alarm-list">
          <div v-if="manualAlarms.length === 0" class="empty-state">无报警记录</div>
          <div
            v-for="alarm in manualAlarms"
            :key="alarm.id"
            class="alarm-item"
            :class="{ acknowledged: alarm.acknowledged }"
          >
            <div class="alarm-item-left">
              <ElIcon v-if="!alarm.acknowledged" color="#f56c6c"><WarningFilled /></ElIcon>
              <ElIcon v-else color="#67c23a"><CircleCloseFilled /></ElIcon>
              <span class="alarm-msg">{{ alarm.msg }}</span>
            </div>
            <div class="alarm-item-right">
              <span class="alarm-time">{{ alarm.time }}</span>
              <ElButton
                v-if="!alarm.acknowledged"
                size="small"
                type="primary"
                text
                @click="acknowledgeAlarm(alarm.id)"
              >
                确认
              </ElButton>
              <ElTag v-else size="small" type="success">已确认</ElTag>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部：趋势图 -->
      <div class="chart-panel">
        <h3>📈 最近数据趋势</h3>
        <div v-if="recentRecords.length === 0" class="empty-state">暂无数据</div>
        <div v-else class="chart-area">
          <DataChart
            :data="recentRecords"
            :columns="chartColumns"
            mode="line"
            x-axis-key="c_time"
            :dual-y-axis="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.web-terminal {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  transition: background-color 0.3s;
}

.web-terminal.alarm-flash {
  background-color: rgba(245, 108, 108, 0.08);
}

.alarm-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #fef0f0, #fde2e2);
  border: 1px solid #f56c6c;
  border-radius: 8px;
  padding: 10px 16px;
  animation: pulse-border 1s infinite;
}

@keyframes pulse-border {
  0%,
  100% {
    border-color: #f56c6c;
  }
  50% {
    border-color: #f89898;
  }
}

.alarm-icon {
  color: #f56c6c;
  font-size: 20px;
}

.alarm-text {
  flex: 1;
  font-weight: 600;
  color: #c45656;
}

.terminal-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
  gap: 16px;
  min-height: 0;
}

.card-panel {
  grid-column: 1;
  grid-row: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.card-panel h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #303133;
}

.sensor-card {
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-time {
  font-size: 12px;
  color: #909399;
}

.card-body-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sensor-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.sensor-label {
  font-size: 12px;
  color: #909399;
}

.sensor-value {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.alarm-panel {
  grid-column: 2;
  grid-row: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.alarm-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.alarm-panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.alarm-controls {
  display: flex;
  gap: 8px;
}

.alarm-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.alarm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  transition: all 0.3s;
}

.alarm-item.acknowledged {
  background: #f0f9eb;
  border-color: #e1f3d8;
}

.alarm-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alarm-msg {
  font-size: 14px;
  color: #303133;
}

.alarm-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alarm-time {
  font-size: 12px;
  color: #909399;
}

.chart-panel {
  grid-column: 1 / -1;
  grid-row: 2;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 16px;
  min-height: 280px;
}

.chart-panel h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #303133;
}

.chart-area {
  height: 260px;
}

.empty-state,
.error-state {
  text-align: center;
  padding: 40px 0;
  color: #909399;
}

.error-state {
  color: #f56c6c;
}

@media (max-width: 767px) {
  .web-terminal {
    padding: 8px;
    gap: 8px;
  }
  .terminal-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }
  .card-panel {
    grid-column: 1;
    grid-row: 1;
  }
  .alarm-panel {
    grid-column: 1;
    grid-row: 2;
  }
  .chart-panel {
    grid-column: 1;
    grid-row: 3;
  }
  .sensor-value {
    font-size: 16px;
  }
  .alarm-controls {
    width: 100%;
  }
}
</style>
