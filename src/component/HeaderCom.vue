<script setup lang="ts">
import { Expand } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

interface Props {
  collapsed: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div class="header-container">
    <div class="header-left">
      <ElIcon class="mobile-toggle" @click="emit('toggle')">
        <Expand />
      </ElIcon>
      <div class="logo">
        <span class="logo-icon">📡</span>
        <span class="logo-text">IoT 物联网平台</span>
      </div>
    </div>
    <div class="header-actions">
      <span class="user-info">管理员</span>
    </div>
  </div>
</template>

<style scoped>
.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 20px;
  color: #fff;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 只在手机端显示 */
.mobile-toggle {
  display: none;
  font-size: 22px;
  cursor: pointer;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 2px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  font-size: 14px;
  opacity: 0.9;
  cursor: pointer;
}

.user-info:hover {
  opacity: 1;
}

/* 手机端 */
@media (max-width: 767px) {
  .header-container {
    padding: 0 12px;
  }
  .mobile-toggle {
    display: inline-flex;
  }
  .logo-text {
    font-size: 16px;
  }
  .logo-icon {
    font-size: 22px;
  }
  .user-info {
    display: none;
  }
}
</style>
