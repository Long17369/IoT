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
