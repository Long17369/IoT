<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElAside, ElContainer, ElFooter, ElHeader, ElMain, ElMenu } from 'element-plus'
import {
  Expand,
  Fold,
  DataBoard,
  DataAnalysis,
  TrendCharts,
  Warning,
  Setting,
  Odometer,
  Operation,
} from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import HeaderCom from './component/HeaderCom.vue'
import MenuCom from './component/MenuCom.vue'
import AlarmBanner from './component/alarm/AlarmBanner.vue'
import { useWebSocket } from '@/composables/useWebSocket'
import type { MenuList } from './types/menuType'

const { alarms, clearAlarms } = useWebSocket()

const router = useRouter()
const route = useRoute()

const menuItems: MenuList = [
  { index: '/', label: '仪表盘', type: 'item', icon: Odometer },
  {
    index: '/data',
    label: '数据监控',
    type: 'submenu',
    icon: DataBoard,
    children: [
      {
        index: '/data/overview',
        label: '数据总览',
        type: 'item',
        icon: DataAnalysis,
      },
      {
        index: '/data/latest',
        label: '最新数据',
        type: 'item',
        icon: TrendCharts,
      },
      {
        index: '/data/faults',
        label: '故障历史',
        type: 'item',
        icon: Warning,
      },
      {
        index: '/data/control-log',
        label: '控制记录',
        type: 'item',
        icon: Operation,
      },
    ],
  },
  {
    index: '/control',
    label: '储运控制',
    type: 'item',
    icon: Setting,
  },
]

const isCollapse = ref(false)

function toggleSidebar() {
  isCollapse.value = !isCollapse.value
}

// 使用 vue-router 导航
function onSelect(index: string) {
  activeIndex.value = index
  router.push(index)
}

const activeIndex = ref(route.path)
</script>

<template>
  <ElContainer direction="vertical" class="app-layout">
    <ElHeader class="app-header">
      <HeaderCom :collapsed="isCollapse" @toggle="toggleSidebar" />
    </ElHeader>
    <!-- 全局告警横幅：所有页面统一显示（警告/错误都走此通道） -->
    <AlarmBanner :alarms="alarms" @clear="clearAlarms" />
    <ElContainer direction="horizontal" class="main-container">
      <ElAside
        :width="isCollapse ? '64px' : '220px'"
        class="aside-transition"
        :class="{
          'aside-collapsed': isCollapse,
        }"
      >
        <!-- 桌面端：侧边栏顶部折叠按钮 -->
        <div class="aside-toggle" @click="toggleSidebar">
          <ElIcon :size="18">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </ElIcon>
          <span v-if="!isCollapse" class="toggle-text">收起</span>
        </div>
        <ElMenu
          :default-active="activeIndex"
          :collapse="isCollapse"
          class="side-menu"
          @select="onSelect"
        >
          <MenuCom v-for="item in menuItems" :key="item.index" :item="item" />
        </ElMenu>
      </ElAside>
      <ElContainer>
        <ElMain class="main-content">
          <div class="main-view">
            <router-view />
          </div>
        </ElMain>
        <ElFooter class="main-footer">
          <div class="footer-content">IoT 物联网平台 &copy; 2026</div>
        </ElFooter>
      </ElContainer>
    </ElContainer>
  </ElContainer>
</template>

<style>
body {
  margin: 0;
  padding: 0;
}

/* 全局美化滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #909399;
}
</style>

<style scoped>
.app-layout {
  height: 100vh;
}

/* Header */
.app-header {
  --el-header-height: 64px;
  padding: 0;
  background: linear-gradient(135deg, #1a73e8, #0d47a1);
}

/* 主区域：header 以下、footer 以上，填满剩余空间 */
.main-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* 侧边栏过渡，禁止溢出滚动条 */
.aside-transition {
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
  border-right: 1px solid #e6e6e6;
}

.aside-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 20px;
  color: #606266;
  cursor: pointer;
  border-bottom: 1px solid #e6e6e6;
  user-select: none;
  transition: background 0.2s;
}

/* 收起时图标居中 */
.aside-collapsed .aside-toggle {
  justify-content: center;
  padding: 0;
}

.aside-toggle:hover {
  background: #f5f7fa;
}

.toggle-text {
  font-size: 13px;
  white-space: nowrap;
}

.side-menu {
  flex: 1;
  overflow-y: auto;
}

.side-menu:not(.el-menu--collapse) {
  width: 220px;
}

/* 主内容区：flex 列，内容填满 + footer 置底 */
.main-content {
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
}

.main-view {
  flex: 1;
  overflow: -moz-hidden-unscrollable;
  padding: 0;
  min-height: 0;
}

.main-footer {
  --el-footer-height: 40px;
  flex-shrink: 0;
}

.footer-content {
  text-align: center;
  color: #909399;
  font-size: 13px;
}
</style>
