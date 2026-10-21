'use client';
import { useEffect, useState } from 'react';
import { FlaskConical, ArrowDownToLine, LoaderCircle } from 'lucide-react';
import type { Sample, Version, Evaluation, Claim } from '@/lib/domain';
import { evaluate, normalizeDraftClaims, redactValue, RULESET } from '@/lib/engine';
import { REPLAY_TIME } from '@/lib/samples';
type Revision = { suggestedAnswer: string; suggestedClaims: Claim[]; model: string; requestId: string; at: string; promptVersion: string; requestedModel?: string; promptRevision?: string; temperature?: number; [key: string]: unknown };
type Arm = { prompt: string; response?: Revision; evaluation?: Evaluation; error?: string };
type Run = { id: string; at: string; evaluationAt: string; rules: string; sample: Sample; arms: Arm[] };
const STORAGE = 'agentlens-prompt-experiments-v1';
const pct = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
export function PromptExperiment({ samples, configured }: { samples: Sample[]; configured: boolean }) {
  const [sampleId, setSampleId] = useState(samples[0]?.id || '');
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { try { const stored = JSON.parse(localStorage.getItem(STORAGE) || '[]'); if (Array.isArray(stored)) setRuns(stored); } catch { /* 保持空记录 */ } }, []);
  const latest = runs[0];
  async function run() {
    const chosen = samples.find(sample => sample.id === sampleId); if (!chosen) return;
    setRunning(true); setError('');
    const sample: Sample = structuredClone(redactValue(chosen));
    const at = new Date().toISOString();
    const evaluationAt = sample.evidence.length > 0 && sample.evidence.every(e => e.fixture) && !sample.id.startsWith('CUSTOM') ? REPLAY_TIME : at;
    const record: Run = { id: `prompt-${Date.now()}`, at, evaluationAt, rules: RULESET, sample, arms: [] };
    for (const prompt of ['invest-v1', 'invest-v2-evidence']) {
      const arm: Arm = { prompt };
      try {
        const response = await fetch('/api/judge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: sample.question, answer: sample.versions[0].answer, intent: sample.intent, kyc: { experience: sample.kyc.experience, risk: sample.kyc.risk, horizon: sample.kyc.horizon }, context: sample.context, evidence: sample.evidence.filter(e => !e.error).map(({ id, source, asOf, fields, units, fixture, period }) => ({ id, source, asOf, fields, units, fixture, period })), promptVersion: prompt }) });
        const body = await response.json() as Revision & { error?: string; message?: string }; if (!response.ok) throw new Error(`${body.error} · ${body.message}`);
        arm.response = body as Revision;
        const version: Version = { id: `${record.id}-${prompt}`, label: '现场修订 · 待审核', model: body.model, prompt, data: sample.evidence.map(e => e.id).join('+'), answer: body.suggestedAnswer, claims: normalizeDraftClaims(body.suggestedClaims || [], sample.evidence) };
        arm.evaluation = evaluate(sample, version, sample.evidence, evaluationAt);
      } catch (failure) { arm.error = failure instanceof Error ? failure.message : '请求失败，没有有效结果'; }
      record.arms.push(arm);
    }
    const next = [record, ...runs].slice(0, 20); setRuns(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { setError('浏览器存储失败，请立即导出实验记录。'); }
    setRunning(false);
  }
  function exportRuns() {
    const blob = new Blob([JSON.stringify(redactValue({ schema: 1, scope: '修订 Prompt 小样本对照，不是 Agent 质量基准', runs }), null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = 'agentlens-real-prompt-experiments.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="panel" style={{ marginBottom: 20 }}>
    <div className="panel-head"><div><h2><FlaskConical size={17}/> 现场修订 Prompt 对照</h2><p>固定问题、原回答、画像、证据与评测时点，分别实际调用两个 Prompt。</p></div><button className="button secondary" disabled={!runs.length} onClick={exportRuns}><ArrowDownToLine size={14}/>导出实验记录</button></div>
    <div className="inline-actions" style={{ padding: '0 24px 18px', flexWrap: 'wrap' }}><select aria-label="真实实验样本" value={sampleId} onChange={e => setSampleId(e.target.value)} disabled={running}>{samples.map(sample => <option key={sample.id} value={sample.id}>{sample.id} · {sample.title}</option>)}</select><button className="button primary" onClick={run} disabled={running || !configured}>{running ? <LoaderCircle size={14} className="spin"/> : <FlaskConical size={14}/>} {running ? '正在执行两次模型调用…' : '运行真实对照（2 次调用）'}</button><small className="muted">最近 {runs.length} 组保存在本浏览器 · temperature = 0</small></div>
    {error && <div className="inline-notice">{error}</div>}
    {latest && <><div className="inline-notice">{latest.sample.id} · {new Date(latest.at).toLocaleString('zh-CN')} · {latest.rules}<br/>{latest.arms.every(arm => arm.response) ? latest.arms[0].response?.model === latest.arms[1].response?.model ? `实际返回模型一致：${latest.arms[0].response?.model}` : '实际返回模型不同：本组不能归因为单一 Prompt 变化' : '本组存在调用失败，不计算改善结论'}</div><div className="version-pair" style={{ alignItems: 'start' }}>{latest.arms.map(arm => <div key={arm.prompt}><h3>{arm.prompt}</h3>{arm.error ? <p className="orange-text">{arm.error}</p> : <><p>修订断言一致率 {pct(arm.evaluation?.accuracy ?? null)} · 覆盖率 {pct(arm.evaluation?.coverage ?? null)}<br/>确定性检查线索 {arm.evaluation?.findings.length ?? '—'} 项</p><p style={{ whiteSpace: 'pre-wrap', maxHeight: 250, overflow: 'auto' }}>{arm.response?.suggestedAnswer}</p><small className="mono" style={{ overflowWrap: 'anywhere' }}>请求 {arm.response?.requestId}</small></>}</div>)}</div></>}
    <div className="experiment-note"><FlaskConical size={17}/><span>这里比较的是审查员生成的修订稿。每个 Prompt 每题仅调用一次，模型抽取可能遗漏断言；相关度评分针对原回答，不能作为修订稿得分。规则未命中也需要人工复核，不声称稳定提升或发布通过。</span></div>
  </section>;
}
