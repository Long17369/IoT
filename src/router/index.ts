import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import About from '@/views/About.vue'
import Contact from '@/views/Contact.vue'
import WebDev from '@/views/WebDev.vue'
import MobileDev from '@/views/MobileDev.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
      meta: { title: '首页' },
    },
    {
      path: '/about',
      name: 'About',
      component: About,
      meta: { title: '关于' },
    },
    {
      path: '/contact',
      name: 'Contact',
      component: Contact,
      meta: { title: '联系我们' },
    },
    {
      path: '/services/web-dev',
      name: 'WebDev',
      component: WebDev,
      meta: { title: 'Web 开发' },
    },
    {
      path: '/services/mobile-dev',
      name: 'MobileDev',
      component: MobileDev,
      meta: { title: '移动开发' },
    },
  ],
})

export default router
