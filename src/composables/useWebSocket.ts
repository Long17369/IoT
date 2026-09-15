import { ref, shallowRef } from 'vue'
import type { WsData, WsAlarm, WsMessage, WsDirectUpdate, WsLock } from '@/server/types'
import { connectWebSocket } from '@/server/api'

/**
 * WebSocket 单例连接管理器
 * 全局只有一个 WebSocket 连接，多组件共享
 * 推送事件：data(实时数据) / alarm(告警) / direct(指令变更) / lock(保护锁)
 * 连接地址由 connectWebSocket() 拼出（location + WS_PATH = /api/ws）
 */

const connected = ref(false)
const latestSensorData = shallowRef<Map<string, WsData>>(new Map())
const alarms = ref<WsAlarm[]>([])
// 断连设备集合（sensor_offline 告警添加，数据恢复/复位清除）
const offlineDevices = ref<Set<string>>(new Set())

// 每设备后台缓存的最近实时记录条数
const MAX_RECENT_RECORDS = 50
// 后台实时记录缓存（模块级：切页面不销毁，WS 持续更新；供“最新数据”页图表使用）
const recentRecords = shallowRef<Map<string, WsData[]>>(new Map())
// 服务端数据修改通知（t_direct 变更；保留最近 20 条，供配置页同步；失败只汇报）
const directUpdates = ref<WsDirectUpdate[]>([])
// 设备保护锁（lock 事件：active = 当前仍有效的锁类型，空数组=已解锁）
const deviceLocks = shallowRef<Map<string, WsLock>>(new Map())
// direct(config_id='lock') 只带锁定标志，拿不到锁类型
const directLockFlags = shallowRef<Map<string, boolean>>(new Map())

/** 锁类型 → 展示名（契约 LockType：blocked / overpressure / pump_idle / leak） */
const LOCK_TYPE_LABELS: Record<string, string> = {
  blocked: '堵塞',
  overpressure: '过压保护',
  pump_idle: '水泵空转',
  leak: '泄漏',
}

/** 锁原因码 → 展示名；后端也可能直接给中文描述，没命中就原样显示 */
const LOCK_REASON_LABELS: Record<string, string> = {
  pressure_zero: '压力归零',
  flow_zero: '流量归零',
  flow_unchanged: '累计流量无变化',
  temp_anomaly: '温度异常',
  overpressure: '压力过高',
  pump_idle: '水泵空转',
  leak: '泄漏',
  sensor_offline: '设备离线',
  sensor_spike: '数据跳变',
}

/** 把 WsLock 拼成可读文本，如 '堵塞（压力归零）'；未锁定返回空串 */
function describeLock(lock: WsLock | undefined): string {
  if (!lock?.locked) return ''
  const active = Array.isArray(lock.active) ? lock.active : []
  const types = active.map((type) => LOCK_TYPE_LABELS[type] ?? type)
  if (lock.type && !active.includes(lock.type)) types.push(LOCK_TYPE_LABELS[lock.type] ?? lock.type)
  const reason = lock.reason ? (LOCK_REASON_LABELS[lock.reason] ?? lock.reason) : ''
  const base = types.length > 0 ? types.join(' · ') : '已锁定'
  return reason && reason !== base ? `${base}（${reason}）` : base
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
// 连接身份 token（后端欢迎消息下发；重连时回传以复用同一身份/定向补推）
let goalToken: string | null = null
const RECONNECT_DELAY = 3000

/**
 * 容错提取欢迎消息里的 goal token（契约未固定挂在哪一层，顶层与 data 内各看一遍）：
 * 拿到后重连时用 `connectWebSocket(oldGoal)` 回传，后端据此复用同一连接身份。
 */
function captureGoal(msg: unknown): void {
  if (!msg || typeof msg !== 'object') return
  const envelope = msg as { goal?: unknown; data?: unknown }
  const nested = (envelope.data ?? null) as { goal?: unknown } | null
  for (const candidate of [envelope.goal, nested?.goal]) {
    if (typeof candidate === 'string' && candidate) {
      goalToken = candidate
      return
    }
  }
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  try {
    // 重连时带上旧 token（首次连接为 undefined）
    ws = connectWebSocket(goalToken ?? undefined)

    ws.onopen = () => {
      console.log('[WebSocket] 已连接到服务器')
      connected.value = true
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        captureGoal(msg)
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

/** 清除指定设备的锁状态缓存（复位广播 / 解锁时调用） */
function clearDeviceLock(d_no: string) {
  if (deviceLocks.value.has(d_no)) {
    const next = new Map(deviceLocks.value)
    next.delete(d_no)
    deviceLocks.value = next
  }
  if (directLockFlags.value.has(d_no)) {
    const next = new Map(directLockFlags.value)
    next.delete(d_no)
    directLockFlags.value = next
  }
}

function handleMessage(msg: WsMessage) {
  switch (msg.event) {
    case 'data': {
      const data = msg.data as WsData
      // 数据到达即视为在线，清除断连标记
      offlineDevices.value.delete(data.d_no)
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
      // 复位事件：清除该设备的预警横幅与锁状态
      if (data.type === 'reset') {
        clearDeviceAlarms(data.d_no)
        clearDeviceLock(data.d_no)
        offlineDevices.value.delete(data.d_no)
        return
      }
      // 断连告警：标记设备离线
      if (data.code === 'sensor_offline') {
        offlineDevices.value = new Set(offlineDevices.value).add(data.d_no)
      }
      // 重连去重：同 id（补推/重复推送）不重复添加
      if (data.id && alarms.value.some((a) => a.id === data.id)) return
      alarms.value = [data, ...alarms.value].slice(0, 50)
      break
    }
    case 'direct': {
      const data = msg.data as WsDirectUpdate
      directUpdates.value = [...directUpdates.value, data].slice(-20)
      // 锁状态会同时以 config_id='lock' 下发（'1'=锁定 / '0'=解锁）
      if (data.config_id === 'lock') {
        const next = new Map(directLockFlags.value)
        if (data.value === '1') next.set(data.d_no, true)
        else next.delete(data.d_no)
        directLockFlags.value = next
      }
      break
    }
    case 'lock': {
      // 保护锁状态变更：active = 当前仍有效的锁类型
      const data = msg.data as WsLock
      const next = new Map(deviceLocks.value)
      if (data.locked) next.set(data.d_no, data)
      else next.delete(data.d_no)
      deviceLocks.value = next
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

  /** 设备保护锁详情（有 lock 事件时为该次锁状态，否则 undefined） */
  function getDeviceLock(d_no: string): WsLock | undefined {
    return deviceLocks.value.get(d_no)
  }

  /** 设备是否处于保护锁状态（lock 事件优先，退回 config_id='lock' 的锁定标志） */
  function isDeviceLocked(d_no: string): boolean {
    const lock = deviceLocks.value.get(d_no)
    if (lock) return lock.locked
    return directLockFlags.value.get(d_no) === true
  }

  /** 锁状态的可读文本，如 '堵塞（压力归零）'；未锁定/无信息时返回空串 */
  function describeDeviceLock(d_no: string): string {
    return describeLock(deviceLocks.value.get(d_no))
  }

  return {
    connected,
    latestSensorData,
    recentRecords,
    directUpdates,
    deviceLocks,
    alarms,
    offlineDevices,
    isOffline: (d_no: string) => offlineDevices.value.has(d_no),
    getDeviceSensorData,
    getRecentRecords: (d_no: string) => recentRecords.value.get(d_no) ?? [],
    getDeviceLock,
    isDeviceLocked,
    describeDeviceLock,
    clearAlarms,
    clearDeviceAlarms,
    clearDeviceLock,
  }
}
