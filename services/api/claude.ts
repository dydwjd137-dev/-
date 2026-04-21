import { config } from '../../config';
import { AccountType, BrokerageId } from '../../types/portfolio';

const BASE = config.backendUrl;

// ── 타입 정의 ──────────────────────────────────────────────────

export interface ChatHighlight {
  text: string;
  color: 'blue' | 'green' | 'red' | 'orange';
}

export interface ChatResponse {
  type: 'app_guide' | 'investment_qa';
  message: string;
  highlights?: ChatHighlight[];
  relatedFeatures?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExtractedHolding {
  ticker: string;
  name?: string;
  quantity: number;
  avgPrice: number;
  currency: 'KRW' | 'USD';
  accountType?: AccountType;
  category?: string;
  brokerage?: BrokerageId;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ImageAnalysisResponse {
  success: boolean;
  holdings: ExtractedHolding[];
  unrecognized?: string[];
  note?: string | null;
}

export interface CsvAnalysisResponse {
  success: boolean;
  holdings: ExtractedHolding[];
  totalCount?: number;
  unrecognized?: string[];
  note?: string | null;
}

export interface PortfolioMetric {
  label: string;
  score: number;
  comment: string;
  color: 'green' | 'blue' | 'orange' | 'red';
}

export interface PortfolioSuggestion {
  priority: number;
  action: string;
  reason: string;
}

export interface PortfolioCommentResponse {
  summary: string;
  metrics: PortfolioMetric[];
  structure: any[];        // string[] (old) | ExpandableItem[] (new)
  cautions?: any[];        // ExpandableItem[] (new)
  risks?: any[];           // string[] (old) — maps to cautions in UI
  notes: any[];            // string[] (old) | ExpandableItem[] (new)
}

export interface TaxSummaryData {
  totalTax: number;
  taxSaving: number;
  annualDividend: number;
  unrealizedGain: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface TaxAccountData {
  type: string;
  balance: number;
  unrealizedGain: number;
  capitalGainTax: number;
  dividendTax: number;
  taxConcentration: number;
}

export interface TaxStrategy {
  rank: number;
  title: string;
  category: 'isa' | 'tax_loss' | 'irp' | 'dividend';
  expectedSaving: number;
  difficulty: 'easy' | 'medium' | 'hard';
  deadline: string | null;
  steps: string[];
  warning: string | null;
}

export interface TaxAlert {
  type: 'info' | 'warning' | 'danger';
  message: string;
}

export interface TaxAdviceResponse {
  summary: TaxSummaryData;
  accounts: TaxAccountData[];
  strategies: TaxStrategy[];
  alerts: TaxAlert[];
}

// ── payload 타입 ────────────────────────────────────────────────

export interface PortfolioCommentPayload {
  totalValue: number;
  totalCost: number;
  profitLossPercent: number;
  holdings: {
    ticker: string;
    category: string;
    currentValue: number;
    profitLossPercent: number;
  }[];
  exchangeRate: number;
}

export interface TaxHoldingItem {
  ticker: string;
  name?: string;
  accountType: string;
  currency: 'KRW' | 'USD';
  unrealizedGainKRW: number;
  profitLossPercent: number;
  annualDividendKRW: number;
}

export interface TaxAdvicePayload {
  byAccount: {
    accountType: string;
    label: string;
    totalValue: number;
    unrealizedGain: number;
    capitalGainsTax: number;
    dividendTax: number;
    holdingCount: number;
  }[];
  holdings: TaxHoldingItem[];
  totalTax: number;
  totalTaxSaved: number;
  annualDividendTotal: number;
  comprehensiveTaxRisk: boolean;
  exchangeRate: number;
}

// ── SSE 파싱 ────────────────────────────────────────────────────

function extractFromSSE(raw: string): string {
  const lines = raw.split('\n');
  let result = '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const json = line.slice(6).trim();
    if (json === '[DONE]') break;
    try {
      const obj = JSON.parse(json);
      if (obj.type === 'content_block_delta' && obj.delta?.text) { result += obj.delta.text; continue; }
      if (obj.choices?.[0]?.delta?.content) { result += obj.choices[0].delta.content; continue; }
      const flat = obj.reply ?? obj.message ?? obj.content ?? obj.text ?? obj.response;
      if (typeof flat === 'string' && !result) result = flat;
    } catch {}
  }
  return result || raw.trim();
}

// ── 공통 fetch 래퍼 ─────────────────────────────────────────────

async function post<T>(path: string, body: object, timeoutMs = 90000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.error(`[Claude API] ${path} ${res.status}:`, errText);
      throw new Error(`서버 오류 ${res.status}: ${errText.slice(0, 200)}`);
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('event-stream') || ct.includes('octet-stream')) {
      const raw = await res.text();
      const extracted = extractFromSSE(raw);
      return { reply: extracted, message: extracted, content: extracted } as any;
    }
    // Read body once (regardless of content-type)
    let rawText = '';
    try { rawText = await res.text(); } catch {}

    console.log('[post] content-type:', ct);
    console.log('[post] rawText first 150:', rawText.substring(0, 150));

    // Always try JSON.parse first — works even if content-type is text/plain
    const stripped = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      const data = JSON.parse(stripped);
      console.log(`[post] JSON.parse OK for ${path}:`, JSON.stringify(data).slice(0, 200));
      return data as T;
    } catch (e: any) {
      console.log('[post] JSON.parse failed:', e?.message);
    }

    // Try extracting JSON object from within the text (handles leading/trailing noise)
    const s = stripped.indexOf('{');
    const e = stripped.lastIndexOf('}');
    if (s !== -1 && e !== -1) {
      try {
        const data = JSON.parse(stripped.slice(s, e + 1));
        console.log(`[post] extracted JSON OK for ${path}:`, JSON.stringify(data).slice(0, 200));
        return data as T;
      } catch {}
    }

    // SSE / streaming fallback
    const extracted = extractFromSSE(rawText);
    if (extracted) {
      console.log('[post] SSE fallback triggered for', path);
      return { reply: extracted, message: extracted, content: extracted } as any;
    }

    if (ct.includes('text/plain')) {
      return { reply: rawText, message: rawText, content: rawText } as any;
    }

    throw new Error('응답 파싱 실패: ' + rawText.slice(0, 100));
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('응답 시간 초과 — 잠시 후 다시 시도해주세요');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── holding 매핑 헬퍼 ───────────────────────────────────────────

function mapHolding(h: any): ExtractedHolding {
  const qty: number = h.quantity ?? 0;
  const totalVal: number = h.totalValue ?? h.evaluationAmount ?? h.evalAmount ?? h.currentValue ?? 0;
  const directPrice: number = h.avgPrice ?? h.purchasePrice ?? h.price ?? 0;
  const avgPrice = directPrice > 0 ? directPrice : (totalVal > 0 && qty > 0 ? totalVal / qty : 0);
  return {
    ticker: h.ticker ?? '',
    name: h.name ?? undefined,
    quantity: qty,
    avgPrice,
    currency: (h.currency === 'KRW' ? 'KRW' : 'USD') as 'KRW' | 'USD',
    accountType: h.broker ?? undefined,
    category: h.category ?? undefined,
    confidence: h.confidence ?? 'medium',
  };
}

// ── 1. 이미지 분석 ──────────────────────────────────────────────

export async function analyzePortfolioImage(
  base64: string,
  mimeType: string = 'image/jpeg',
): Promise<ImageAnalysisResponse> {
  const pureBase64 = base64.replace(/^data:[^;]+;base64,/, '');
  const data = await post<any>('/api/claude/analyze-image', { image: pureBase64, mediaType: mimeType }, 60000);
  const raw: any[] = data.data?.holdings ?? data.holdings ?? data.stocks ?? data.items ?? [];
  return {
    success: data.success ?? true,
    holdings: raw.map(h => mapHolding(h)),
    unrecognized: data.data?.unrecognized ?? data.unrecognized ?? [],
    note: data.data?.note ?? data.note ?? null,
  };
}

// 하위 호환
export async function analyzeImage(base64: string, mimeType?: string): Promise<ExtractedHolding[]> {
  const res = await analyzePortfolioImage(base64, mimeType);
  return res.holdings;
}

// ── 2. CSV 분석 ─────────────────────────────────────────────────

export async function analyzeCSV(text: string): Promise<CsvAnalysisResponse> {
  const data = await post<any>('/api/claude/analyze-csv', { text }, 45000);
  const raw: any[] = data.data?.holdings ?? data.holdings ?? data.stocks ?? data.items ?? [];
  return {
    success: data.success ?? true,
    holdings: raw.map(h => mapHolding(h)),
    totalCount: data.totalCount ?? raw.length,
    unrecognized: data.unrecognized ?? [],
    note: data.note ?? null,
  };
}

// 하위 호환
export async function analyzeCsv(text: string): Promise<ExtractedHolding[]> {
  const res = await analyzeCSV(text);
  return res.holdings;
}

// ── 공통 JSON 추출 헬퍼 ─────────────────────────────────────────
// post()가 JSON.parse 실패 시 { reply, message, content } 래퍼로 감싸거나,
// 백엔드가 { data: {...} }로 한 겹 더 감쌀 수 있음. 모두 처리.

function extractJson(raw: any): any {
  let d = raw;

  // Layer 1: post() 래퍼 { reply, message, content, advice } — 텍스트 안에 JSON이 있을 때
  if (d && !d.summary && !d.strategies && !d.metrics) {
    const textField: string = d.content ?? d.message ?? d.reply ?? d.advice ?? '';
    if (textField) {
      // 1) Strip markdown fences
      // 2) Collapse literal newlines → spaces (Claude embeds real \n inside string values
      //    which makes JSON.parse fail on the raw string)
      const stripped = textField
        .replace(/```json\s*/gi, '').replace(/```\s*/g, '')
        .replace(/\r\n|\r|\n/g, ' ')
        .trim();
      const s = stripped.indexOf('{');
      const e = stripped.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        try {
          const parsed = JSON.parse(stripped.slice(s, e + 1));
          console.log('[extractJson] re-parse OK, keys:', Object.keys(parsed ?? {}));
          d = parsed;
        } catch (err: any) {
          console.log('[extractJson] re-parse FAILED:', err?.message?.slice(0, 80));
        }
      }
    }
  }

  // Layer 2: nested { data: {...} } wrapper
  if (d?.data && (d.data.summary || d.data.strategies || d.data.metrics)) {
    d = d.data;
  }

  // Layer 3: backend fallback — summary field contains the entire JSON string
  // Route it back through Layer 1 by wrapping in { reply: ... }
  if (d?.summary && typeof d.summary === 'string' && d.summary.trim().startsWith('{')) {
    const recovered = extractJson({ reply: d.summary });
    if (recovered?.summary && typeof recovered.summary === 'string' && !recovered.summary.trim().startsWith('{')) {
      console.log('[extractJson] recovered via reply wrap, keys:', Object.keys(recovered));
      d = recovered;
    }
  }

  return d;
}

// ── 3. 포트폴리오 AI 코멘트 ────────────────────────────────────

function parseJsonString(str: string): any | null {
  const variants = [
    str,
    str.replace(/\r\n|\r|\n/g, ' '),
    str.replace(/\r\n|\r|\n/g, ' ').replace(/,\s*([\]}])/g, '$1'),
  ];
  for (const v of variants) {
    const s = v.indexOf('{');
    const e = v.lastIndexOf('}');
    if (s === -1 || e === -1) continue;
    try { return JSON.parse(v.slice(s, e + 1)); } catch {}
  }
  return null;
}

export async function getPortfolioComment(
  payload: PortfolioCommentPayload,
): Promise<PortfolioCommentResponse> {
  const raw = await post<any>('/api/claude/portfolio-comment', { portfolio: payload }, 90000);

  let d = extractJson(raw);

  // Backend fallback: summary contains the entire JSON string
  if (d?.summary && typeof d.summary === 'string' && d.summary.trim().startsWith('{')) {
    const inner = parseJsonString(d.summary);
    if (inner?.summary && typeof inner.summary === 'string' && !inner.summary.trim().startsWith('{')) {
      d = inner;
    }
  }

  if (d?.summary && typeof d.summary === 'string' && !d.summary.trim().startsWith('{') &&
      (Array.isArray(d.metrics) || Array.isArray(d.structure))) {
    return {
      summary: d.summary,
      metrics: Array.isArray(d.metrics) ? d.metrics : [],
      structure: Array.isArray(d.structure) ? d.structure : [],
      cautions: Array.isArray(d.cautions) ? d.cautions : undefined,
      risks: Array.isArray(d.risks) ? d.risks : undefined,
      notes: Array.isArray(d.notes) ? d.notes : [],
    };
  }
  return { summary: '', metrics: [], structure: [], notes: [] };
}

// ── 4. 챗봇 ────────────────────────────────────────────────────

export async function chatWithAssistant(
  message: string,
  history: ChatMessage[] = [],
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: message }];
  const data = await post<any>('/api/claude/chat', { messages }, 45000);
  if (data.type && data.message) return data as ChatResponse;
  const text = data.content ?? data.reply ?? data.message ?? data.text ?? '';
  return { type: 'investment_qa', message: text, highlights: [], relatedFeatures: [] };
}

// 하위 호환
export async function chat(message: string, history: ChatMessage[] = []): Promise<string> {
  const res = await chatWithAssistant(message, history);
  return res.message;
}

// ── 5. AI 절세 어드바이저 ──────────────────────────────────────

export async function getTaxAdvice(payload: TaxAdvicePayload): Promise<TaxAdviceResponse> {
  const raw = await post<any>('/api/claude/tax-advice', { portfolio: payload }, 120000);

  let data = extractJson(raw);

  // Backend fallback: advice/summary field contains full JSON string
  const fallbackText = data?.advice ?? data?.comment ?? data?.message ?? '';
  if (fallbackText && typeof fallbackText === 'string' && fallbackText.trim().startsWith('{')) {
    const inner = parseJsonString(fallbackText);
    if (inner?.summary && inner?.strategies) data = inner;
  }
  if (data?.summary && typeof data.summary === 'string' && data.summary.trim().startsWith('{')) {
    const inner = parseJsonString(data.summary);
    if (inner?.summary && inner?.strategies) data = inner;
  }

  if (data.summary && data.strategies) return data as TaxAdviceResponse;
  const text = data.advice ?? data.comment ?? data.message ?? data.content ?? '';
  return {
    summary: {
      totalTax: payload.totalTax,
      taxSaving: payload.totalTaxSaved,
      annualDividend: payload.annualDividendTotal,
      unrealizedGain: 0,
      riskLevel: payload.comprehensiveTaxRisk ? 'high' : 'low',
    },
    accounts: payload.byAccount.map(a => ({
      type: a.accountType,
      balance: a.totalValue,
      unrealizedGain: a.unrealizedGain,
      capitalGainTax: a.capitalGainsTax,
      dividendTax: a.dividendTax,
      taxConcentration: 0,
    })),
    strategies: text
      ? [{ rank: 1, title: 'AI 분석 결과', category: 'isa' as const, expectedSaving: 0, difficulty: 'medium' as const, deadline: null, steps: [text], warning: null }]
      : [],
    alerts: [],
  };
}
