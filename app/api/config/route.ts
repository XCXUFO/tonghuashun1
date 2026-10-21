import { setting } from '@/lib/runtime';
export async function GET() {
  return Response.json({ modelConfigured: !!setting('DEEPSEEK_API_KEY'), model: setting('DEEPSEEK_MODEL') || 'deepseek-chat', fuyaoConfigured: !!setting('FUYAO_API_KEY'), ifindConfigured: !!setting('IFIND_MCP_KEY'), dataProvider: '扶摇 REST API + iFinD MCP', storage: 'browser-local' }, { headers: { 'Cache-Control': 'no-store' } });
}
