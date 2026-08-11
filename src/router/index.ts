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
      path: '/data/control-log',
      name: 'ControlLog',
      component: () => import('@/views/ControlLogView.vue'),
      meta: { title: '控制命令记录' },
    },
  ],
})

export default router
