import { env } from 'cloudflare:workers';
export function setting(name: string): string { return String((env as unknown as Record<string, unknown>)[name] ?? process.env[name] ?? ''); }
