import type { Evidence } from './domain';
export class DataError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }
export async function fetchFuyao(key: string, thscode: string, kind: 'quote' | 'finance', fetcher: typeof fetch = fetch): Promise<Evidence> {
  if (!key) throw new DataError('NOT_CONFIGURED', '扶摇数据密钥尚未配置。');
  if (!/^\d{6}\.(SH|SZ|BJ)$/.test(thscode)) throw new DataError('INVALID_SYMBOL', '请输入完整 A 股代码，例如 600519.SH。');
  const path = kind === 'finance' ? '/api/a-share/financials/income-statements' : '/api/a-share/prices/snapshot';
  const query = kind === 'finance' ? new URLSearchParams({ thscode, period: 'annual', limit: '1' }) : new URLSearchParams({ thscodes: thscode });
  const response = await fetcher(`https://fuyao.aicubes.cn${path}?${query}`, { headers: { 'X-api-key': key }, signal: AbortSignal.timeout(18000) });
  if (response.status === 429) throw new DataError('RATE_LIMITED', '数据源限流，请稍后重试。');
  if (!response.ok) throw new DataError(`HTTP_${response.status}`, '数据源 HTTP 请求失败。');
  const body = await response.json() as { code: number; request_id: string; message: string; data: { timestamp: number; item: Record<string, unknown>[] } | null };
  if (body.code !== 0) {
    const text: Record<string, string> = { '2001': '数据密钥缺失或无效。', '2003': '当前密钥没有该数据能力权限。', '3001': '标的不存在。', '3002': '数据尚未就绪。', '4001': '数据源限流，请稍后重试。' };
    throw new DataError(String(body.code ?? 'INVALID_ENVELOPE'), text[String(body.code)] ?? '数据源返回业务错误。');
  }
  const row = body.data?.item?.find(item => item.thscode === thscode);
  if (!row) throw new DataError('EMPTY_DATA', '未返回目标标的，不能核验。');
  const fields = kind === 'finance' ? ['operating_income', 'net_profit', 'operating_profit'] : ['last_price', 'price_change_ratio_pct', 'prev_price', 'volume'];
  const timestamp = kind === 'finance' ? row.report_date_ms : body.data?.timestamp;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) throw new DataError('MISSING_TIME', '原始数据缺少有效时间戳，拒绝当作当前证据。');
  const units: Record<string, string> = { last_price: '元', prev_price: '元', price_change_ratio_pct: '%', volume: '股', operating_income: '元', net_profit: '元', operating_profit: '元' };
  return { id: `fuyao-${body.request_id}`, thscode, source: `扶摇 · ${kind === 'quote' ? 'A 股行情快照' : '年度合并利润表'}`, sourceUrl: `https://fuyao.aicubes.cn${path}?${query}`, asOf: new Date(timestamp).toISOString(), retrievedAt: new Date().toISOString(), requestId: body.request_id, fields: Object.fromEntries(fields.map(f => [f, typeof row[f] === 'number' && Number.isFinite(row[f]) ? row[f] as number : null])), units, period: kind === 'finance' ? `${row.fiscal_year}-FY` : undefined, fixture: false, raw: body };
}
