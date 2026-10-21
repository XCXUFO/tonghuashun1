import { fetchFuyao, DataError } from '@/lib/providers';
import { setting } from '@/lib/runtime';
import { fetchIfindQuote } from '@/lib/ifind';
export async function POST(request: Request) {
  try {
    const body = await request.json() as { thscode?: string; kind?: string; provider?: string };
    if (!body || typeof body.thscode !== 'string' || !['quote', 'finance'].includes(body.kind || '') || !['fuyao', 'ifind'].includes(body.provider || 'fuyao')) return Response.json({ error: 'INVALID_INPUT', message: '数据请求参数无效。' }, { status: 400 });
    if (body.provider === 'ifind' && body.kind !== 'quote') return Response.json({ error: 'UNSUPPORTED_KIND', message: '当前 iFinD 适配只支持行情快照。' }, { status: 400 });
    const evidence = body.provider === 'ifind' ? await fetchIfindQuote(setting('IFIND_MCP_KEY'), body.thscode) : await fetchFuyao(setting('FUYAO_API_KEY'), body.thscode, body.kind as 'quote' | 'finance');
    return Response.json({ evidence }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof DataError ? error.code : 'PROVIDER_FAILURE', message: error instanceof DataError ? error.message : '数据源超时或响应无法解析，请保留待核验状态并重试。' }, { status: error instanceof DataError && error.code === 'INVALID_SYMBOL' ? 400 : 503 });
  }
}
