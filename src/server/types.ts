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

export type DbName = `field${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`

// 字段映射类型
export interface FieldMapper {
  id: number
  f_name: string
  db_name: DbName
  p_name: string
  unit: string // 单位
  type: '1' | '2' | '3' // 1: 文本, 2: 图片, 3: 视频
  visible: '0' | '1' // 0: 不可见, 1: 可见
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
  online: string | null // "实时数据" | "实时数据"
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

export interface ErrorData {
  id: number
  d_no: string
  e_msg: string
  e_no: string
  type: string
  c_time: string
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
// TODO: 根据实际业务需求调整字段类型和命名，确保与 MQTT 消息格式一致

export interface MQTTMessageBase {
  Real_Time: string // 心跳时间, HH:mm:ss 格式
}

// 心跳消息 (heartbeat)
export interface HeartbeatPayload extends MQTTMessageBase {
  VID: string // 设备编号 (d_no)
  online: string // "true" 或 "false"
}

// 数据信息 (data)
export interface DataPayload extends MQTTMessageBase {
  Tin: string
  Tout: string
  LXin: string
  out_net?: 'true'
}

// 设备控制状态 (device_control)
export interface DeviceControlPayload extends MQTTMessageBase {
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

type DeviceControlPayloadOUTRefId =
  | 'Real_time'
  | 'mode'
  | 'TinDL'
  | 'TinDH'
  | 'LXD'
  | 'HinD'
  | 'light_status'
  | 'Bright'
  | 'fan_mode'
  | 'SpeedM2'
  | 'SpeedM1'
  | 'fan_status'
  | 'kongtiao_status'

type DeviceControlPayloadOUT = {
  [key in DeviceControlPayloadOUTRefId]?: string
}

// 设备状态信息 (device_status)
export interface DeviceStatusPayload extends MQTTMessageBase {
  gas: string
  humi_over: string
  fan_status: string
  kongtiao_status: string
}

// 设备信息 (VID_PID)
export interface VIDPIDInfo {
  VID: string
  PID: string
}

// MQTT 入
interface MQTTMapper {
  heartbeat: HeartbeatPayload
  data: DataPayload
  device_control: DeviceControlPayload
  device_status: DeviceStatusPayload
  VID_PID: VIDPIDInfo
}

export type MQTTTopic = keyof MQTTMapper
export type MQTTPayload<T extends MQTTTopic> = MQTTMapper[T]

export interface MQTTMessage {
  topic: MQTTTopic
  payload: MQTTPayload<MQTTTopic>
}

// MQTT 出
interface MQTTMapperOut {
  'device_control/': DeviceControlPayloadOUT
}

export type MQTTTopicOut = keyof MQTTMapperOut
export type MQTTPayloadOut<T extends MQTTTopicOut> = MQTTMapperOut[T]

export interface MQTTMessageOut {
  topic: MQTTTopicOut
  d_no?: string
  payload: MQTTPayloadOut<MQTTTopicOut>
}

// ========== WebSocket 推送事件类型 ==========
export type WsEventType = 'data' | 'device_status' | 'device_status_sync' | 'alarm'

// WebSocket 传感器数据推送
export interface WsData {
  d_no: string
  timestamp: string
  temp: string
  humi: string
  light: string
}

// WebSocket 设备状态推送
export interface WsDeviceStatus {
  d_no: string
  online: string
  timestamp: string
}

// WebSocket 告警推送
export interface WsAlarm {
  d_no: string
  type: string // 'alarm' | 'error'
  message: string
  timestamp: string
}

export type WsMessageData = WsData | WsDeviceStatus | WsAlarm | WsDeviceStatus[]

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
