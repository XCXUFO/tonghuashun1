// 本地验收工具：只读私密环境文件；不输出、不写入密钥。
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createJudgeHandler } from '../lib/judge.ts';
import { fetchFuyao } from '../lib/providers.ts';
import { fetchIfindQuote } from '../lib/ifind.ts';
import { SAMPLES, REPLAY_TIME } from '../lib/samples.ts';
import { evaluate, normalizeDraftClaims, redactValue, RULESET } from '../lib/engine.ts';
const directory = path.resolve(process.argv[2] || 'outputs/agent-quality-platform/evidence');
await fs.mkdir(directory, { recursive: true });
const privateText = await fs.readFile('.dev.vars', 'utf8');
const settings = Object.fromEntries(privateText.split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]; }));
const setting = name => settings[name] || '';
const save = (name, value) => fs.writeFile(path.join(directory, name), JSON.stringify(redactValue(value), null, 2) + '\n');
const startedAt = new Date().toISOString();
const connectors = [];
for (const [provider, kind] of [['fuyao', 'quote'], ['fuyao', 'finance'], ['ifind', 'quote']]) {
  const at = new Date().toISOString();
  try {
    const evidence = provider === 'fuyao' ? await fetchFuyao(setting('FUYAO_API_KEY'), '600519.SH', kind) : await fetchIfindQuote(setting('IFIND_MCP_KEY'), '600519.SH');
    await save(`${provider}-${kind}-raw.json`, { environment: 'local-node', at, evidence });
    connectors.push({ provider, kind, environment: 'local-node', status: 'success', requestId: evidence.requestId, asOf: evidence.asOf, file: `${provider}-${kind}-raw.json` });
  } catch (error) { const result = { provider, kind, environment: 'local-node', at, status: 'failed', code: error.code || error.name, message: error.message }; connectors.push(result); await save(`${provider}-${kind}-error.json`, result); }
}
await save('connector-index.json', connectors);
const handler = createJudgeHandler({ setting });
const runs = [];
for (const id of ['QA-001', 'QA-004', 'QA-007']) {
  const sample = structuredClone(SAMPLES.find(sample => sample.id === id));
  const frozen = { question: sample.question, answer: sample.versions[0].answer, intent: sample.intent, kyc: { experience: sample.kyc.experience, risk: sample.kyc.risk, horizon: sample.kyc.horizon }, context: sample.context, evidence: sample.evidence };
  const run = { id: `live-${id}`, at: new Date().toISOString(), environment: 'local-node-real-provider', rules: RULESET, evaluationAt: REPLAY_TIME, snapshotSha256: createHash('sha256').update(JSON.stringify(frozen)).digest('hex'), sample, arms: [] };
  for (const prompt of ['invest-v1', 'invest-v2-evidence']) {
    const response = await handler(new Request('http://local/api/judge', { method: 'POST', body: JSON.stringify({ ...frozen, promptVersion: prompt }) }));
    const body = await response.json();
    const arm = { prompt, status: response.status, response: body };
    if (response.ok) {
      const version = { id: `${run.id}-${prompt}`, label: '真实模型修订 · 待人工审核', model: body.model, prompt, data: sample.evidence.map(e => e.id).join('+'), answer: body.suggestedAnswer, claims: normalizeDraftClaims(body.suggestedClaims || [], sample.evidence) };
      arm.version = version; arm.evaluation = evaluate(sample, version, sample.evidence, REPLAY_TIME);
    }
    run.arms.push(arm);
    await save('real-prompt-experiments.json', { scope: '真实修订 Prompt 实验：匿名构造输入，不代表实时行情或统计显著提升', startedAt, runs: [...runs, run] });
    console.log(JSON.stringify({ sample: id, prompt, httpStatus: response.status, model: body.model, requestId: body.requestId }));
  }
  run.sameActualModel = run.arms.every(arm => arm.status === 200) && run.arms[0].response.model === run.arms[1].response.model;
  runs.push(run);
  await save('real-prompt-experiments.json', { scope: '真实修订 Prompt 实验：匿名构造输入，不代表实时行情或统计显著提升', startedAt, runs });
}
const failedEvidence = structuredClone(SAMPLES.find(s => s.id === 'QA-003'));
const stale = structuredClone(SAMPLES.find(s => s.id === 'QA-002'));
const refreshed = structuredClone(stale.evidence); refreshed.forEach(e => { e.asOf = REPLAY_TIME; e.retrievedAt = REPLAY_TIME; e.id += '-synthetic-refreshed'; });
await save('data-version-replay.json', { scope: '构造数据的时效回归，仅修改数据快照，绝非真实行情刷新', sample: stale, at: REPLAY_TIME, stale: evaluate(stale, stale.versions[0], stale.evidence, REPLAY_TIME), refreshedEvidence: refreshed, refreshed: evaluate(stale, stale.versions[0], refreshed, REPLAY_TIME), interfaceFailure: { sample: failedEvidence, evaluation: evaluate(failedEvidence, failedEvidence.versions[0], failedEvidence.evidence, REPLAY_TIME) } });
await save('fixture-baseline-regression.json', { scope: '内置构造样本的确定性回归，不是模型现场实验', at: REPLAY_TIME, samples: SAMPLES.map(sample => redactValue(sample)), results: SAMPLES.flatMap(sample => sample.versions.map(version => evaluate(sample, version, sample.evidence, REPLAY_TIME))) });
console.log(JSON.stringify({ completed: true, directory, connectors: connectors.map(({ provider, kind, status, code }) => ({ provider, kind, status, code })) }));
