// 统一响应格式
export interface SuccessResponse<T> {
  success: true
  data: T
}

export type ErrorCode = 'INVALID_PARAMETER' | 'DATABASE_ERROR' | 'INVALID_PARAMS' | 'UNKNOWN_ERROR'

export interface ErrorResponse {
  success: false
  error: {
    message: string
    code: ErrorCode
  }
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

export type DbName = `field${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}` | 'id' | 'd_no' | 'c_time'

// 字段映射类型
export interface FieldMapper {
  id: number
  f_name: string
  db_name: DbName
  p_name: string
  unit: string // 单位
  type: '1' | '2' | '3' // 1: 文本, 2: 图片, 3: 视频
  visible: '0' | '1' // 0: 不可见, 1: 可见
  chartable: '0' | '1' // 0: 不可图表化, 1: 可图表化
  mapping?: string | null // 值映射词表(JSON)：值->显示名，词条全局唯一复用
}

// 传感器数据类型
export interface Data {
  id: number
  d_no: string | null
  field1: string | null
  field2: string | null
  field3: string | null
  field4: string | null
  field5: string | null
  field6: string | null
  field7: string | null
  field8: string | null
  field9: string | null
  field10: string | null
  c_time: string // ISO 8601 格式
}

export interface DirectConfig {
  id: string
  ref_id: string | null // 关联的指令配置Id
  ref_value: string | null // 关联的指令配置值, 如果配置的Id的值与此处吻合, 显示该指令配置
  t_name: string // 指令名称
  f_type: string // 前端类型。1：开关按钮；2：输入框；3：滑动按钮；4：时间框；5：单选框
  f_value: string | null // 指令值；输入框：不配置；单选框：具体的值；滑动按钮：取值范围
  mode: string | null // 模式。1=全局指令
  max: string | null
  min: string | null
  order: string | null // 排序
  topic: string | null // 指令对应的主题
  preffix: string | null // 前缀
  icon: string | null // 图标库中的安全证书图标符号
  type: 'int' | 'float' | 'string' | null // 数据类型
  default_value: string | null // 默认值（t_direct 无值时的显示/回退值）
}

export interface Direct {
  id: number
  config_id: string
  value: string | null
  d_no: string
}

export interface GetDirectParams {
  d_no: string
}

export interface UpdateDirectParams {
  config_id: string
  value: string
  d_no: string
}

export interface DataCount {
  count: number
}

export interface Device {
  id: number
  device_name: string
  remarks: string | null
  c_time: string
  number: string
}

export type CreateDeviceParams = Omit<Device, 'id' | 'c_time'>
export type UpdateDeviceParams = Partial<Omit<Device, 'id' | 'c_time'>>

export type WhereOperator = '=' | '>' | '<' | '>=' | '<='

export interface WhereCondition {
  value: string
  operator: WhereOperator
}

export interface Where {
  [key: string]: WhereCondition | WhereCondition[]
}

// 查询参数
export interface DataQueryParams {
  table: string // 表名
  orderBy: string // 默认: "id"
  columns?: string[]
  where?: Where
  order?: string // 默认: false
  limit?: string // 默认: 10, 最大: 100
  offset?: string // 默认: 0
  distinct?: string
}

// ========== MQTT 消息类型 ==========

// 数据信息 (data) —— 新数据结构
export interface DataPayload {
  id: string // 设备/数据源 id
  time: string // 数据时间
  wen_du1: string | number // 温度1
  wen_du2: string | number // 温度2
  jia_re: string | number // 加热开关状态
  shui_beng: string | number // 水泵状态
  liu_liang1: string | number // 流量总计
  liu_liang2: string | number // 瞬时流量 L/min
  pressure: string | number // 水流压力
}

// 设备控制状态 (device_control)
export interface DeviceControlPayload {
  id: string // 设备/数据源 id
  Real_Time: string
  mode: string
  TinDL: string
  TinDH: string
  TBegin: string
  TEnd: string
  LXD: string
  Bright: string
  SpeedM2: string
  SpeedM1: string
}

// MQTT 入
interface MQTTMapper {
  data: DataPayload
  device_control: DeviceControlPayload
}

export type MQTTTopic = keyof MQTTMapper
export type MQTTPayload<T extends MQTTTopic> = MQTTMapper[T]

export interface MQTTMessage {
  topic: MQTTTopic
  payload: MQTTPayload<MQTTTopic>
}

// 控制指令（command.ts 新协议）
export type ControlTarget = 'heat' | 'water'
export type ControlAction = 'on' | 'off'

// ========== WebSocket 推送事件类型 ==========
export type WsEventType = 'data' | 'alarm' | 'direct'

// WebSocket 传感器数据推送（新数据结构）
export interface WsData {
  d_no: string
  timestamp: string
  wen_du1: string
  wen_du2: string
  jia_re: string
  shui_beng: string
  liu_liang1: string
  liu_liang2: string
  pressure: string
  /** 数据质量标记：true=疑似跳变/无效数据（前端曲线标注） */
  invalid?: boolean
}

// WebSocket 告警推送
// type: 'alarm' 堵塞/故障预警 | 'error' 错误 | 'reset' 手动复位（清除该设备实时预警）
export interface WsAlarm {
  id: string // 预警唯一 ID（基于发生时间生成，用于重连去重）
  d_no: string
  type: string // 'alarm' | 'error' | 'reset'
  message: string
  timestamp: string
  /** 告警事件码（如 pressure_zero / spike / leak，对应后端 alarmConfig） */
  code?: string
  /** 等级：error=红 / warning=黄 */
  level?: 'error' | 'warning'
  /** 自定义颜色（空则按等级兜底） */
  color?: string
  /** 全屏闪烁（后端先实现格式，前端暂不渲染） */
  fullscreen?: boolean
}

// WebSocket 数据修改通知（服务端修改 t_direct 后推送，供前端同步配置页；失败时 error 只汇报不处理）
export interface WsDirectUpdate {
  d_no: string
  config_id: string
  value?: string // 修改后的值（失败时缺失）
  source?: string // 控制来源：manual/auto/config（预留 device）
  success: boolean
  error?: string // 修改失败的错误信息
}

export type WsMessageData = WsData | WsAlarm | WsDirectUpdate

export interface WsMessage {
  event: WsEventType
  data: WsMessageData
}

/** 前端 getData 查询参数（对应 URL query string） */
export interface FrontendDataQueryParams {
  limit?: number
  offset?: number
  order_table?: string
  desc?: boolean
  where?: Where
}

export interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
}
