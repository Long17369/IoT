import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/Home.vue'),
      meta: { title: '仪表盘' },
    },
    {
      path: '/control',
      name: 'StorageControl',
      component: () => import('@/views/StorageControl.vue'),
      meta: { title: '储运舱控制' },
    },
    {
      path: '/data/overview',
      name: 'DataView',
      component: () => import('@/views/DataView.vue'),
      meta: { title: '数据总览' },
    },
    {
      path: '/data/latest',
      name: 'LatestData',
      component: () => import('@/views/LatestData.vue'),
      meta: { title: '最新数据' },
    },
    {
      path: '/data/faults',
      name: 'FaultHistory',
      component: () => import('@/views/FaultHistory.vue'),
      meta: { title: '故障历史' },
    },
    {
      path: '/about',
      name: 'About',
      component: () => import('@/views/About.vue'),
      meta: { title: '关于' },
    },
    {
      path: '/contact',
      name: 'Contact',
      component: () => import('@/views/Contact.vue'),
      meta: { title: '联系我们' },
    },
    {
      path: '/services/web-dev',
      name: 'WebDev',
      component: () => import('@/views/WebDev.vue'),
      meta: { title: 'Web 远程终端' },
    },
    {
      path: '/services/mobile-dev',
      name: 'MobileDev',
      component: () => import('@/views/MobileDev.vue'),
      meta: { title: '移动端终端' },
    },
    {
      path: '/services/local-display',
      name: 'LocalDeviceDisplay',
      component: () => import('@/views/LocalDeviceDisplay.vue'),
      meta: { title: '本地设备显示' },
    },
  ],
})

export default router
