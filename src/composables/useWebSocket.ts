import { ref, shallowRef } from 'vue'
import type { WsData, WsAlarm, WsMessage, WsDirectUpdate } from '@/server/types'

/**
 * WebSocket 单例连接管理器
 * 全局只有一个 WebSocket 连接，多组件共享
 * 仅推送数据(data)与告警(alarm)
 */

// 开发环境通过 Vite proxy 代理到后端，生产环境直连
const WS_URL =
  import.meta.env.MODE === 'development'
    ? `ws://${window.location.hostname}:${window.location.port}/ws`
    : `ws://${window.location.hostname}:${import.meta.env.VITE_API_PORT || '10452'}/ws`

const connected = ref(false)
const latestSensorData = shallowRef<Map<string, WsData>>(new Map())
const alarms = ref<WsAlarm[]>([])

// 每设备后台缓存的最近实时记录条数
const MAX_RECENT_RECORDS = 50
// 后台实时记录缓存（模块级：切页面不销毁，WS 持续更新；供“最新数据”页图表使用）
const recentRecords = shallowRef<Map<string, WsData[]>>(new Map())
// 服务端数据修改通知（t_direct 变更；保留最近 20 条，供配置页同步；失败只汇报）
const directUpdates = ref<WsDirectUpdate[]>([])

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const RECONNECT_DELAY = 3000

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  try {
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[WebSocket] 已连接到服务器')
      connected.value = true
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        handleMessage(msg)
      } catch {
        // 忽略非 JSON 消息
      }
    }

    ws.onclose = () => {
      console.log('[WebSocket] 连接已断开，3秒后重连...')
      connected.value = false
      ws = null
      scheduleReconnect()
    }

    ws.onerror = (err) => {
      console.error('[WebSocket] 连接错误:', err)
    }
  } catch (e) {
    console.error('[WebSocket] 创建连接失败:', e)
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, RECONNECT_DELAY)
}

/** 清除指定设备的所有预警横幅（模块顶层，供 handleMessage 与组件共享） */
function clearDeviceAlarms(d_no: string) {
  alarms.value = alarms.value.filter((a) => a.d_no !== d_no)
}

function handleMessage(msg: WsMessage) {
  switch (msg.event) {
    case 'data': {
      const data = msg.data as WsData
      // 更新最新数据
      const newMap = new Map(latestSensorData.value)
      newMap.set(data.d_no, data)
      latestSensorData.value = newMap
      // 后台累积该设备最近记录（切页面不销毁，逐条实时更新，供图表实时滚动）
      const newRecords = new Map(recentRecords.value)
      const list = [...(newRecords.get(data.d_no) ?? []), data].slice(-MAX_RECENT_RECORDS)
      newRecords.set(data.d_no, list)
      recentRecords.value = newRecords
      break
    }
    case 'alarm': {
      const data = msg.data as WsAlarm
      // 复位事件：清除该设备所有实时预警横幅
      if (data.type === 'reset') {
        clearDeviceAlarms(data.d_no)
        return
      }
      // 重连去重：同 id（补推/重复推送）不重复添加
      if (data.id && alarms.value.some((a) => a.id === data.id)) return
      alarms.value = [data, ...alarms.value].slice(0, 50)
      break
    }
    case 'direct': {
      const data = msg.data as WsDirectUpdate
      directUpdates.value = [...directUpdates.value, data].slice(-20)
      break
    }
  }
}

// 模块加载时自动初始化连接
connect()

/**
 * 全局 WebSocket 数据 hook
 * 所有组件共享同一连接，数据响应式同步
 */
export function useWebSocket() {
  function getDeviceSensorData(d_no: string): WsData | undefined {
    return latestSensorData.value.get(d_no)
  }

  function clearAlarms() {
    alarms.value = []
  }

  return {
    connected,
    latestSensorData,
    recentRecords,
    directUpdates,
    alarms,
    getDeviceSensorData,
    getRecentRecords: (d_no: string) => recentRecords.value.get(d_no) ?? [],
    clearAlarms,
    clearDeviceAlarms,
  }
}
