import { ref, shallowRef } from 'vue'
import type { WsData, WsDeviceStatus, WsAlarm, WsMessage } from '@/server/types'

/**
 * WebSocket 单例连接管理器
 * 全局只有一个 WebSocket 连接，多组件共享
 */

// 开发环境通过 Vite proxy 代理到后端，生产环境直连
const WS_URL =
  import.meta.env.MODE === 'development'
    ? `ws://${window.location.hostname}:${window.location.port}/ws`
    : `ws://${window.location.hostname}:${import.meta.env.VITE_API_PORT || '10452'}/ws`

const connected = ref(false)
const latestSensorData = shallowRef<Map<string, WsData>>(new Map())
const deviceStatuses = shallowRef<Map<string, WsDeviceStatus>>(new Map())
const alarms = ref<WsAlarm[]>([])

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

function handleMessage(msg: WsMessage) {
  switch (msg.event) {
    case 'data': {
      const data = msg.data as WsData
      const newMap = new Map(latestSensorData.value)
      newMap.set(data.d_no, data)
      latestSensorData.value = newMap
      break
    }
    case 'device_status': {
      const data = msg.data as WsDeviceStatus
      const newMap = new Map(deviceStatuses.value)
      newMap.set(data.d_no, data)
      deviceStatuses.value = newMap
      break
    }
    case 'device_status_sync': {
      // 后端推送全量设备状态（权威来源），直接替换
      const list = msg.data as WsDeviceStatus[]
      const newMap = new Map<string, WsDeviceStatus>()
      for (const item of list) {
        newMap.set(item.d_no, item)
      }
      deviceStatuses.value = newMap
      console.log('[WebSocket] 设备状态同步:', list.length, '个设备')
      break
    }
    case 'alarm': {
      const data = msg.data as WsAlarm
      alarms.value = [data, ...alarms.value].slice(0, 50)
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

  function getDeviceOnline(d_no: string): boolean {
    const status = deviceStatuses.value.get(d_no)
    if (!status) return false
    return status.online === 'true'
  }

  function clearAlarms() {
    alarms.value = []
  }

  return {
    connected,
    latestSensorData,
    deviceStatuses,
    alarms,
    getDeviceSensorData,
    getDeviceOnline,
    clearAlarms,
  }
}
