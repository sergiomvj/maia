export type LogFields = Record<string, unknown>

export function newRequestId(): string {
  const g = (globalThis as any)
  return g.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function hashUserId(userId?: string | null): string | null {
  if (!userId) return null
  try {
    // cheap hash (not cryptographic), avoids PII in logs
    let h = 0
    for (let i = 0; i < userId.length; i++) h = ((h << 5) - h) + userId.charCodeAt(i)
    return Math.abs(h >>> 0).toString(36)
  } catch { return null }
}

export function createLogger(request_id: string, base: LogFields = {}) {
  const t0 = Date.now()
  const common = { request_id, ...base }
  const write = (level: 'info' | 'error', msg: string, extra: LogFields = {}) => {
    const payload = { level, msg, t: new Date().toISOString(), latency_ms: Date.now() - t0, ...common, ...extra }
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload))
  }
  return {
    info: (msg: string, extra?: LogFields) => write('info', msg, extra),
    error: (msg: string, extra?: LogFields) => write('error', msg, extra),
    fields: common,
  }
}
