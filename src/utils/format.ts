/**
 * 数值显示格式化工具
 *
 * fmtNum：小数位超过 maxDigits（默认2）时四舍五入截断；
 * 整数 / 小数位不足 / 非数值（如 '--'、时间字符串、状态文字）原样返回。
 *
 * 用于避免累计流量等浮点长小数（如 25.523904499999983）占满显示，
 * 同时保持开关类 0/1、温度 39.5、瞬时流量 8.16 等原样不变。
 */
export function fmtNum(val: unknown, maxDigits = 2): string {
  if (val === null || val === undefined || val === '') return ''
  const s = String(val).trim()
  if (s === '') return ''
  const n = Number(s)
  if (Number.isNaN(n)) return s
  const dot = s.indexOf('.')
  if (dot === -1 || s.length - dot - 1 <= maxDigits) return s
  return n.toFixed(maxDigits)
}

/**
 * 时间工具：服务端出入网时间字段（`c_time` / `minTime` / `maxTime` / `start` / `end` /
 * WS 的 `timestamp`）在网络上一律是 **ISO 8601 UTC** 字符串（服务端 `Date` 经 JSON 序列化）。
 * 展示时统一用浏览器本地化格式（`toLocaleString()` 等），两个方向都不再手工拼时间串。
 */

/** 时间文本形态：ISO 8601（含毫秒与 Z/偏移）或库中的 'YYYY-MM-DD HH:mm:ss' */
const TIME_TEXT_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/**
 * 解析服务端时间（ISO 8601 UTC；兼容库中 'YYYY-MM-DD HH:mm:ss' 的墙钟写法）。
 *
 * 非时间文本（如 '--'、数字字符串、状态文字）返回 null，避免 `new Date('123')` 之类的误解析；
 * 墙钟写法（无时区后缀）按浏览器本地时区解析——即服务端当初写入的那个时刻。
 */
export function parseServerTime(val: unknown): Date | null {
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (!TIME_TEXT_RE.test(s)) return null
  const d = new Date(s.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

/** 服务端时间 → 本地可读文本（浏览器本地化格式）；解析不出来时原样返回 */
export function fmtServerTime(val: unknown): string {
  const d = parseServerTime(val)
  return d ? d.toLocaleString() : String(val ?? '')
}

/**
 * 秒数 → 可读时长：≥1 小时 `Xh MMm`、≥1 分钟 `Xm SSs`、否则 `Xs`。
 * 空值 / 非数值 / 负数返回空串（占位文本由调用方决定）。
 */
export function fmtDuration(val: unknown): string {
  if (val === null || val === undefined || val === '') return ''
  const n = Number(val)
  if (!Number.isFinite(n) || n < 0) return ''
  const total = Math.round(n)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}
