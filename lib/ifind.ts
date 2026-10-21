import type { Evidence } from './domain';
import { DataError } from './providers';
const STOCK_URL = 'https://api-mcp.51ifind.com:8643/ds-mcp-servers/hexin-ifind-ds-stock-mcp';
type Rpc = { error?: unknown; result?: { tools?: { name: string }[]; isError?: boolean; content?: { type: string; text?: string }[] } };
export async function fetchIfindQuote(key: string, thscode: string): Promise<Evidence> {
  if (!key) throw new DataError('IFIND_NOT_CONFIGURED', 'iFinD MCP 密钥尚未配置。');
  if (!/^\d{6}\.(SH|SZ|BJ)$/.test(thscode)) throw new DataError('INVALID_SYMBOL', '请输入完整 A 股代码。');
  let session = ''; let id = 0;
  async function rpc(method: string, params?: unknown, notify = false) {
    const response = await fetch(STOCK_URL, { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', ...(!notify ? { id: ++id } : {}), method, ...(params !== undefined ? { params } : {}) }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new DataError(`IFIND_HTTP_${response.status}`, 'iFinD 服务请求失败，检查权益或稍后重试。');
    session = response.headers.get('mcp-session-id') || session;
    const text = await response.text();
    if (!text.trim()) return {} as Rpc;
    let data: Rpc;
    try { const payload = text.startsWith('event:') || text.startsWith('data:') ? text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).find(l => l.startsWith('{')) || '{}' : text; data = JSON.parse(payload); } catch { throw new DataError('IFIND_INVALID_RPC', 'iFinD 未返回可解析的 RPC 响应。'); }
    if (data.error || data.result?.isError) throw new DataError('IFIND_RPC_ERROR', 'iFinD 工具调用返回错误，不能作为可用证据。');
    return data;
  }
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'AgentLens', version: '0.1.0' } });
  await rpc('notifications/initialized', undefined, true);
  const listed = await rpc('tools/list', {});
  if (!listed.result?.tools?.some(t => t.name === 'stock_highfreq_quotes')) throw new DataError('IFIND_TOOL_UNAVAILABLE', '当前密钥没有实时行情工具。');
  const response = await rpc('tools/call', { name: 'stock_highfreq_quotes', arguments: { symbols: thscode, indicators: '最新价,涨跌幅', data_mode: 'real_time' } });
  const content = response.result?.content?.find(c => c.type === 'text')?.text;
  if (!content) throw new DataError('IFIND_EMPTY_DATA', 'iFinD 没有返回行情内容。');
  const body = JSON.parse(content) as { code: number; data?: { tables?: unknown[][] } };
  if (body.code !== 1) throw new DataError('IFIND_BUSINESS_ERROR', 'iFinD 返回业务失败或无数据。');
  const table = body.data?.tables; const headers = table?.[0]?.map(String) || [];
  const row = table?.slice(1).find(r => String(r[headers.indexOf('证券代码')]) === thscode);
  if (!row) throw new DataError('IFIND_EMPTY_DATA', '未返回对应证券的行情。');
  const time = String(row[headers.indexOf('time')] || '');
  const asOf = new Date(time.replace(' ', 'T') + '+08:00');
  if (!Number.isFinite(asOf.getTime())) throw new DataError('IFIND_MISSING_TIME', 'iFinD 原始数据时间缺失或无效。');
  function numeric(name: string) { const value = row?.[headers.indexOf(name)]; if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
  return { id: `ifind-${crypto.randomUUID()}`, thscode, source: 'iFinD MCP · A 股实时快照', sourceUrl: 'https://mcp.51ifind.com/#/docs/guide-prepare', asOf: asOf.toISOString(), retrievedAt: new Date().toISOString(), requestId: `client:${crypto.randomUUID()} / rpc:${id}`, fields: { last_price: numeric('最新价'), price_change_ratio_pct: numeric('涨跌幅') }, units: { last_price: '元', price_change_ratio_pct: '%' }, fixture: false, raw: response };
}
