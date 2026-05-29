<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { WarningFilled, Close } from '@element-plus/icons-vue'
import type { WsAlarm } from '@/types/api'

const props = defineProps<{
  alarms: WsAlarm[]
}>()

const emit = defineEmits<{
  clear: []
}>()

const visible = ref(true)
const dismissedIds = ref<Set<string>>(new Set())

// 用 d_no+timestamp 作为唯一标识
function alarmKey(alarm: WsAlarm): string {
  return `${alarm.d_no}-${alarm.timestamp}`
}

const activeAlarms = computed(() =>
  props.alarms.filter((a) => !dismissedIds.value.has(alarmKey(a))).slice(0, 3),
)

watch(
  () => props.alarms.length,
  () => {
    if (props.alarms.length > 0) {
      visible.value = true
    }
  },
)

function dismiss(key: string) {
  dismissedIds.value.add(key)
}

function clearAll() {
  dismissedIds.value = new Set(props.alarms.map(alarmKey))
  emit('clear')
}
</script>

<template>
  <Transition name="banner">
    <div v-if="visible && activeAlarms.length > 0" class="alarm-banner">
      <div class="banner-content">
        <el-icon class="banner-icon"><WarningFilled /></el-icon>
        <div class="alarm-list">
          <div v-for="alarm in activeAlarms" :key="alarmKey(alarm)" class="alarm-item">
            <span class="alarm-device">[{{ alarm.d_no }}]</span>
            <span class="alarm-msg">{{ alarm.message }}</span>
            <span class="alarm-time">{{ alarm.timestamp }}</span>
            <el-icon class="dismiss-btn" @click="dismiss(alarmKey(alarm))">
              <Close />
            </el-icon>
          </div>
        </div>
        <button class="clear-btn" @click="clearAll">清除全部</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.alarm-banner {
  background: linear-gradient(135deg, #fef0f0, #fff2e8);
  border: 1px solid #fbc4c4;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
}

.banner-icon {
  color: #f56c6c;
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.alarm-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alarm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}

.alarm-device {
  font-weight: 600;
  color: #e6a23c;
}

.alarm-msg {
  color: #f56c6c;
  flex: 1;
}

.alarm-time {
  color: #909399;
  font-size: 12px;
}

.dismiss-btn {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 14px;
  transition: color 0.2s;
}

.dismiss-btn:hover {
  color: #f56c6c;
}

.clear-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  color: #f56c6c;
  border-color: #f56c6c;
}

.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
