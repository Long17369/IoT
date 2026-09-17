/** 列定义：描述数据字段的展示方式，单位等由此处定义 */
export interface ColumnDef {
  /** 数据字段名 */
  key: string
  /** 列标题 */
  label: string
  /** 单位（如 °C、%、ppm、V） */
  unit?: string
  /** 单位显示位置：header=仅表头、cell=仅单元格、both=都显示，默认 both */
  unitPlacement?: 'header' | 'cell' | 'both'
  /** 是否可用于图表（折线图/柱状图的数值轴） */
  chartable?: boolean
  /** 是否可排序，默认 false */
  sortable?: boolean
  /** 值映射词表：值 -> 显示名（由字段映射 mapper 驱动） */
  mapper?: Record<string, string>
  /** 映射命中时是否以 "(原始值)" 备注显示，默认 false */
  showOriginal?: boolean
}

/** 排序信息，由 DataTable emit 给上层做排序逻辑 */
export interface SortInfo {
  prop: string
  order: 'ascending' | 'descending' | null
}

/** 数据展示组件的显示模式 */
export type DisplayMode = 'table' | 'line' | 'bar' | 'pie'

/** 传给 DataDisplay 的 Props（上层使用） */
export interface DataDisplayProps {
  /** 数据数组 */
  data: Record<string, unknown>[]
  /** 显示条数 */
  count: number
  /** 列定义 */
  columns: ColumnDef[]
  /** 允许的展示模式，默认全部 */
  modes?: DisplayMode[]
}

/** DataCard 卡片组件的字段配置 */
export interface CardField {
  /** 数据字段名 */
  key: string
  /** 显示标签 */
  label: string
  /** 单位 */
  unit?: string
  /** 显示位置 */
  section?: 'header' | 'body' | 'footer'
  /** 是否用 Tag 展示 */
  tag?: boolean
  /** 仅 header section 有效：值→Tag type 映射 */
  statusMap?: Record<string, 'success' | 'warning' | 'danger' | 'info' | ''>
  /** 值映射词表：值 -> 显示名（由字段映射 mapper 驱动） */
  mapper?: Record<string, string>
  /** 值格式化方式：'datetime' = 服务端 ISO 时间 → 浏览器本地可读文本 */
  format?: 'datetime'
}
