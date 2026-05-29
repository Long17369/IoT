<script setup lang="ts">
defineProps<{
  online: boolean
  deviceName: string
  deviceNumber?: string
}>()
</script>

<template>
  <div class="device-tag" :class="{ online: online, offline: !online }">
    <span class="status-dot"></span>
    <div class="device-info">
      <span class="device-name">{{ deviceName }}</span>
      <span v-if="deviceNumber" class="device-number">#{{ deviceNumber }}</span>
    </div>
    <span class="status-text">{{ online ? '在线' : '离线' }}</span>
  </div>
</template>

<style scoped>
.device-tag {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #f5f7fa;
  transition: all 0.3s ease;
}

.device-tag.online {
  background: #f0f9eb;
  border: 1px solid #c2e7b0;
}

.device-tag.offline {
  background: #fef0f0;
  border: 1px solid #fbc4c4;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c0c4cc;
  flex-shrink: 0;
}

.online .status-dot {
  background: #67c23a;
  animation: pulse 2s infinite;
}

.offline .status-dot {
  background: #f56c6c;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(103, 194, 58, 0);
  }
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.device-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.device-number {
  font-size: 12px;
  color: #909399;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 10px;
  border-radius: 12px;
}

.online .status-text {
  color: #67c23a;
  background: #e1f3d8;
}

.offline .status-text {
  color: #f56c6c;
  background: #fef0f0;
}
</style>
