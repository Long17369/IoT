import type { Component } from 'vue'

interface MenuItemData {
  type: 'item'
  index: string
  label: string
  icon?: Component
  component: Component
}

interface SubMenuData {
  type: 'submenu'
  index: string
  label: string
  icon?: Component
  children: MenuList
}

export type MenuData = MenuItemData | SubMenuData
export type MenuList = MenuData[]
