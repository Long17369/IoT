<script setup lang="ts">
import { ElMenuItem, ElSubMenu, ElIcon } from 'element-plus'
import type { MenuData } from '../types/menuType'

interface Props {
  item: MenuData
}

defineProps<Props>()
</script>

<template>
  <ElSubMenu v-if="item.type === 'submenu'" :index="item.index">
    <template #title>
      <ElIcon v-if="item.icon"><component :is="item.icon" /></ElIcon>
      <span>{{ item.label }}</span>
    </template>
    <MenuCom v-for="child in item.children" :key="child.index" :item="child" />
  </ElSubMenu>
  <ElMenuItem v-else :index="item.index">
    <ElIcon v-if="item.icon"><component :is="item.icon" /></ElIcon>
    <span>{{ item.label }}</span>
  </ElMenuItem>
</template>
