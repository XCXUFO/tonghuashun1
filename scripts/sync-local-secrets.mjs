import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
const input = new URL('../本地连接配置.txt', import.meta.url);
if (existsSync(input)) {
  const allowed = new Set(['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'FUYAO_API_KEY', 'IFIND_MCP_URL', 'IFIND_MCP_KEY']);
  const lines = readFileSync(input, 'utf8').split(/\r?\n/).filter(line => !line.trim() || line.trim().startsWith('#') || allowed.has(line.split('=')[0].trim()));
  const output = new URL('../.dev.vars', import.meta.url);
  writeFileSync(output, lines.join('\n') + '\n', { mode: 0o600 });
  chmodSync(output, 0o600);
}
