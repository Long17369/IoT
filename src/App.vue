<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElAside, ElContainer, ElFooter, ElHeader, ElMain, ElMenu } from 'element-plus'
import {
  HomeFilled,
  InfoFilled,
  PhoneFilled,
  Service,
  Monitor,
  Iphone,
  Expand,
  Fold,
  DataBoard,
  DataAnalysis,
  TrendCharts,
} from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import HeaderCom from './component/HeaderCom.vue'
import MenuCom from './component/MenuCom.vue'
import type { MenuList, MenuData } from './types/menuType'
import Home from './views/Home.vue'
import About from './views/About.vue'
import Contact from './views/Contact.vue'
import WebDev from './views/WebDev.vue'
import MobileDev from './views/MobileDev.vue'
import DataView from './views/DataView.vue'
import LatestData from './views/LatestData.vue'

const menuItems: MenuList = [
  { index: '/', label: '首页', type: 'item', icon: HomeFilled, component: Home },
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
        component: DataView,
      },
      {
        index: '/data/latest',
        label: '最新数据',
        type: 'item',
        icon: TrendCharts,
        component: LatestData,
      },
    ],
  },
  { index: '/about', label: '关于', type: 'item', icon: InfoFilled, component: About },
  { index: '/contact', label: '联系我们', type: 'item', icon: PhoneFilled, component: Contact },
  {
    index: '/services',
    label: '服务',
    type: 'submenu',
    icon: Service,
    children: [
      {
        index: '/services/web-dev',
        label: 'Web 开发',
        type: 'item',
        icon: Monitor,
        component: WebDev,
      },
      {
        index: '/services/mobile-dev',
        label: '移动开发',
        type: 'item',
        icon: Iphone,
        component: MobileDev,
      },
    ],
  },
]

const MOBILE_BREAKPOINT = 768

const isCollapse = ref(window.innerWidth < MOBILE_BREAKPOINT)
const isMobile = ref(window.innerWidth < MOBILE_BREAKPOINT)

function updateMobile() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
  if (isMobile.value) {
    isCollapse.value = true
  }
}

function toggleSidebar() {
  isCollapse.value = !isCollapse.value
}

// 移动端点击菜单项后自动收起侧栏
function onSelect(index: string) {
  activeIndex.value = index
  window.location.hash = '#' + index
  if (isMobile.value) {
    isCollapse.value = true
  }
}

// 点击遮罩层关闭侧栏
function closeSidebar() {
  if (isMobile.value) {
    isCollapse.value = true
  }
}

// 从菜单树中扁平查找组件
function findComponentByIndex(items: MenuList, target: string): MenuData | undefined {
  for (const item of items) {
    if (item.type === 'item' && item.index === target) return item
    if (item.type === 'submenu') {
      const found = findComponentByIndex(item.children, target)
      if (found) return found
    }
  }
}

function getHashPath(): string {
  return window.location.hash.replace(/^#/, '') || '/'
}

const activeIndex = ref(getHashPath())

const currentComponent = computed(() => {
  const item = findComponentByIndex(menuItems, activeIndex.value)
  return item && item.type === 'item' ? item.component : Home
})

function onHashChange() {
  activeIndex.value = getHashPath()
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('resize', updateMobile)
  updateMobile()
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('resize', updateMobile)
})
</script>

<template>
  <ElContainer direction="vertical" class="app-layout">
    <ElHeader class="app-header">
      <HeaderCom :collapsed="isCollapse" @toggle="toggleSidebar" />
    </ElHeader>
    <ElContainer direction="horizontal" class="main-container">
      <!-- 移动端遮罩 -->
      <div v-if="isMobile && !isCollapse" class="sidebar-overlay" @click="closeSidebar" />
      <ElAside
        :width="isCollapse ? '64px' : '220px'"
        class="aside-transition"
        :class="{
          'aside-collapsed': isCollapse,
          'aside-mobile': isMobile,
          'aside-mobile-open': isMobile && !isCollapse,
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
      <ElMain class="main-content">
        <div class="main-view">
          <component :is="currentComponent" />
        </div>
        <ElFooter class="main-footer">
          <div class="footer-content">IoT 物联网平台 &copy; 2026</div>
        </ElFooter>
      </ElMain>
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
  overflow: hidden;
}

.main-view {
  flex: 1;
  overflow-y: auto;
  padding: 0;
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

/* ===== 手机端适配 ===== */
@media (max-width: 767px) {
  .aside-toggle {
    display: none;
  }
  .aside-mobile {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition:
      transform 0.3s ease,
      width 0.3s ease;
  }

  .aside-mobile-open {
    transform: translateX(0);
  }

  .sidebar-overlay {
    position: absolute;
    inset: 0;
    z-index: 99;
    background: rgba(0, 0, 0, 0.35);
  }
}
</style>
