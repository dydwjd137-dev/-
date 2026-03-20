const { Router } = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL       = 'claude-sonnet-4-6';
const OPUS_MODEL  = 'claude-opus-4-6';
const IMAGE_MODEL = 'claude-sonnet-4-6';

// ──────────────────────────────────────────────
// 시스템 프롬프트 & 공통 상수
// ──────────────────────────────────────────────

const APP_SYSTEM_PROMPT = `너는 "KongDad Portfolio" 앱의 AI 어시스턴트야.
앱 사용법뿐 아니라 주식, ETF, 배당투자, 포트폴리오 전략, 절세, 경제 지표 등
투자 관련 질문에도 전문적으로 답변해줘. 항상 한국어로 친절하고 간결하게 답변해.

[앱 주요 기능]
- 홈: 히트맵과 원형그래프로 포트폴리오 시각화
- 배당: 월간/연간 예상 배당금, 배당 달력
- 분석: 카테고리별/계좌별 비중 분석
- 성과: 일간/주간/월간/연간 수익률
- 절세: 양도소득세, 배당소득세 예상, ISA/연금 절세 효과

반드시 아래 JSON 형식으로만 응답해. 마크다운이나 설명 텍스트 없이 순수 JSON만:
{
  "type": "app_guide 또는 investment_qa",
  "message": "답변 텍스트",
  "highlights": [{ "text": "강조 키워드", "color": "blue 또는 green 또는 red 또는 orange" }],
  "relatedFeatures": ["관련 탭 이름"]
}
앱 기능 질문이면 type을 app_guide, 주식/투자 질문이면 investment_qa로 설정해.`;

const PRICE_TERMS = `매수 평균가를 avgPrice로 추출할 때 다음 규칙을 따라줘:

[avgPrice로 사용할 것 - 매수/취득 관련]
컬럼명이나 레이블: 평단가, 매입가, 평균매입가, 매수평균가, 평균단가, 매수가,
취득가, 평균취득가, 1주 평균금액, 주당평균가, 1주당 평균, 주당매입가,
avgPrice, average price, cost basis, purchase price, avg cost

[avgPrice로 절대 사용하지 말 것 - 현재 시세 관련]
컬럼명이나 레이블: 현재가, 현재가격, 현재금액, 평가금액, 평가액, 시세, 종가,
current price, market price, last price, close price, evaluation

[판단 방법]
- 각 숫자 옆이나 위에 있는 컬럼 헤더/레이블을 먼저 확인해
- 같은 행에 여러 가격이 있으면 레이블을 보고 매수 관련 항목만 선택해
- 레이블이 없어서 불확실하면 avgPrice를 null로 반환해
- avgPrice가 없거나 0이면, 해당 종목의 총평가금액(평가금액, 평가잔액)을 totalValue 필드에 담아줘
- totalValue를 quantity로 나누면 avgPrice를 역산할 수 있어`;

const PORTFOLIO_ANALYSIS_SYSTEM = `당신은 포트폴리오 구조 분석 전문가입니다.

[핵심 원칙]
- 분석가의 시선으로 포트폴리오 구조를 객관적으로 서술한다.
- 특정 종목의 매수/매도/전환을 추천하지 않는다.
- 각 자산의 역할과 구조적 특성을 설명하되, 그것이 좋다/나쁘다는 평가를 최소화한다.
- 커버드콜, 레버리지 등 전략형 ETF는 장단점을 균형 있게 서술한다.
- 사용자가 왜 이 구성을 선택했는지 존중하는 톤을 유지한다.
- "~하세요", "~해야 합니다" 같은 지시형 표현 대신 "~한 구조입니다", "~한 특성이 있습니다" 형태로 서술한다.

[요약/상세 2단계 구조]
- cardSummary: 카드 첫 화면에 보이는 짧은 텍스트. 1문장 이내.
- detail: 카드를 펼쳤을 때 보이는 설명. 2~4문장. 초보자도 이해할 수 있도록 쉽게 서술.

반드시 순수 JSON만 출력하세요. 마크다운, 설명 텍스트, 코드블록(\`\`\`) 없이 순수 JSON만.`;

const REBALANCE_SYSTEM = `당신은 포트폴리오 리밸런싱 분석 도우미입니다.

[핵심 원칙]
- 목표 비중과 현재 비중의 차이를 수치로 명확히 보여준다.
- 괴리가 큰 자산부터 우선순위를 매긴다.
- "매수하세요/매도하세요"가 아니라 "목표 대비 N% 초과/부족 상태입니다"로 서술한다.
- 리밸런싱 실행 여부는 사용자의 판단에 맡긴다.
- 시장 상황 예측이나 타이밍 조언을 하지 않는다.

반드시 순수 JSON만 출력하세요. 마크다운, 설명 텍스트, 코드블록(\`\`\`) 없이 순수 JSON만.`;

const REPORT_SYSTEM = `당신은 투자 기록 정리 전문가입니다.

[핵심 원칙]
- 기간 내 포트폴리오 변동을 객관적 데이터로만 정리한다.
- 수치와 팩트 중심으로 기록한다. 성찰적/감정적 문장을 쓰지 않는다.
- "~했습니다" 체로 서술하되, "이번 주는 ~를 다시 확인한 시간이었습니다" 같은 성찰적 톤은 절대 사용하지 않는다.
- 시장 예측이나 매매 추천을 포함하지 않는다.
- 감정적 표현("대박", "폭락", "교훈", "느낀 점")을 사용하지 않는다.
- 숫자, 종목명, 수익률, 배당금 등 팩트만 나열한다.

반드시 순수 JSON만 출력하세요. 마크다운, 설명 텍스트, 코드블록(\`\`\`) 없이 순수 JSON만.`;

const TAX_SYSTEM = `당신은 한국 거주자의 해외주식·국내주식 절세 전문가입니다.

[핵심 원칙 — 한국주식 vs 해외주식 과세 구분]

1. 해외주식 (미국 ETF 포함: VOO, SCHD, JEPQ, QQQ, BND, SGOV, GLDM 등)
   - 양도소득세: 연간 해외주식 양도차익 합산 250만원 초과분에 22% (지방세 포함)
   - 배당소득세: 미국 원천징수 15% + 한국 추가 과세 없음 (조세조약). 단, 금융소득 연 2000만원 초과 시 종합과세
   - 손익통산: 해외주식 간 양도손익 통산 가능
   - 신고: 매년 5월 양도소득세 확정신고

2. 한국주식 (코스피/코스닥 상장)
   - 양도소득세: 대주주가 아닌 개인투자자는 비과세 (2025년 현재 금투세 폐지 상태)
   - 배당소득세: 15.4% (소득세 14% + 지방소득세 1.4%)
   - 대주주 기준: 종목당 10억원 이상 보유 시 양도세 과세

3. ISA 계좌
   - 서민형: 400만원까지 비과세, 초과분 9.9% 분리과세
   - 일반형: 200만원까지 비과세, 초과분 9.9% 분리과세
   - 납입한도: 연 2,000만원, 총 1억원
   - 의무가입기간: 3년
   - 해외주식 직접 매매 불가 → 국내 상장 해외 ETF로 대체
   - 중요: ISA에서 미국 ETF(VOO, SCHD 등)를 직접 매매할 수 없음

4. IRP/연금저축
   - 세액공제: 연간 납입액 중 최대 900만원에 대해 13.2%~16.5% 세액공제
   - 55세 이후 연금 수령 시 3.3%~5.5% 저율 과세
   - 중도인출: 기타소득세 16.5% 부과
   - 해외 ETF 직접 매매 불가

[절대 금지]
- 한국 상장 주식의 양도차익에 "양도소득세 과세 대상"이라고 말하지 마라 (대주주 제외)
- 미국 ETF를 ISA/IRP에서 직접 매매할 수 있다고 말하지 마라
- currency가 USD인 종목에 국내주식 세제를 적용하지 마라
- currency가 KRW인 종목에 해외주식 세제를 적용하지 마라

[요약/상세 2단계 구조]
- cardSummary: 카드에 처음 보이는 한줄 요약
- detail: 카드 클릭 시 보이는 상세 내용

반드시 순수 JSON만 출력하세요. 마크다운, 설명 텍스트, 코드블록(\`\`\`) 없이 순수 JSON만.`;

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

/**
 * Claude 응답에서 JSON을 안전하게 추출.
 * - 줄바꿈 공백 치환: JSON 문자열 값 안의 literal \n 파싱 실패 방지
 * - 후행 쉼표 제거: trailing comma JSON 오류 방지
 */
function parseJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // 1차: 코드블록 제거 + 줄바꿈 공백 치환 + 후행 쉼표 제거 후 직접 파싱
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/,\s*([\]}])/g, '$1')
    .trim();
  try { return JSON.parse(cleaned); } catch {}

  // 2차: { ... } 범위 추출
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s !== -1 && e !== -1) {
    try { return JSON.parse(cleaned.slice(s, e + 1)); } catch {}
  }

  // 3차: 줄바꿈 유지한 상태로 코드블록만 제거 후 파싱
  const raw2 = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(raw2); } catch {}
  const match = raw2.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }

  console.error('[parseJSON] All attempts failed. First 200:', text.substring(0, 200));
  return null;
}

function ensureArray(portfolio) {
  if (Array.isArray(portfolio)) return portfolio;
  if (portfolio && typeof portfolio === 'object') return Object.values(portfolio);
  return [];
}

function calcWeights(portfolio) {
  const list = ensureArray(portfolio);
  const total = list.reduce((sum, h) => sum + (h.totalValue || 0), 0);
  if (total === 0) return list.map(h => ({ ...h, currentWeight: 0 }));
  return list.map(h => ({
    ...h,
    currentWeight: Math.round(((h.totalValue || 0) / total) * 10000) / 100,
  }));
}

function classifyMarket(holding) {
  const currency = (holding.currency || '').toUpperCase();
  if (currency === 'USD' || currency === 'EUR' || currency === 'JPY' || currency === 'GBP') return 'overseas';
  if (currency === 'KRW') return 'domestic';
  const ticker = (holding.ticker || '').toUpperCase();
  if (/^\d{6}$/.test(ticker) || ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return 'domestic';
  return 'overseas';
}

function fmt만원(n) {
  const val = n ?? 0;
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`;
  if (abs >= 10_000)      return `${sign}${Math.round(abs / 10_000)}만원`;
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

// ──────────────────────────────────────────────
// 라우터 생성
// ──────────────────────────────────────────────

function createClaudeRouter(apiKey) {
  const router = Router();
  const client = new Anthropic({ apiKey });

  // ── 1. 챗봇 Q&A ────────────────────────────
  router.post('/chat', async (req, res) => {
    const { messages, system, max_tokens } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: max_tokens ?? 1024,
        system: system ?? APP_SYSTEM_PROMPT,
        messages: messages.slice(-10),
      });
      const raw = response.content[0]?.text?.trim() ?? '';
      const parsed = parseJSON(raw);
      if (parsed && parsed.type && parsed.message) {
        res.json(parsed);
      } else {
        res.json({ type: 'investment_qa', message: raw, highlights: [], relatedFeatures: [] });
      }
    } catch (err) {
      console.error('[Claude] chat error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ── 2. 이미지 분석 ──────────────────────────
  router.post('/analyze-image', async (req, res) => {
    const { image, mediaType = 'image/jpeg' } = req.body;
    if (!image) return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    try {
      const response = await client.messages.create({
        model: IMAGE_MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: `이 증권계좌 화면에서 보유 종목 정보를 추출해줘.\n\n${PRICE_TERMS}\n\n반드시 아래 JSON 형식으로만 응답해. 인식 못한 값은 null:\n{"holdings":[{"ticker":"VOO","name":"Vanguard S&P 500 ETF","quantity":10.5,"avgPrice":450.00,"totalValue":4725.00,"currency":"USD","confidence":"high","broker":null}],"unrecognized":[],"note":null}` }
          ]
        }]
      });
      const text = response.content[0].text.trim();
      const parsed = parseJSON(text);
      if (parsed) {
        res.json({ success: true, data: parsed });
      } else {
        res.json({ success: false, raw: text, error: 'JSON 파싱 실패' });
      }
    } catch (err) {
      console.error('[Claude] analyze-image error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ── 3. CSV 분석 ─────────────────────────────
  router.post('/analyze-csv', async (req, res) => {
    const { text: csvText } = req.body;
    if (!csvText) return res.status(400).json({ error: '텍스트 데이터가 없습니다.' });
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `다음 스프레드시트 데이터에서 포트폴리오 종목을 추출해줘.\n\n${PRICE_TERMS}\n\n데이터:\n${csvText}\n\n반드시 아래 JSON 형식으로만 응답해:\n{"holdings":[{"ticker":"VOO","name":"Vanguard S&P 500 ETF","quantity":10.5,"avgPrice":450.00,"currency":"USD","confidence":"high","broker":null}],"totalCount":1,"unrecognized":[],"note":null}`
        }]
      });
      const raw = response.content[0].text.trim();
      const parsed = parseJSON(raw);
      if (parsed) {
        res.json({ success: true, data: parsed });
      } else {
        res.json({ success: false, raw, error: 'JSON 파싱 실패' });
      }
    } catch (err) {
      console.error('[Claude] analyze-csv error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ── 4. 포트폴리오 AI 분석 (Opus) ──────────────
  router.post('/portfolio-comment', async (req, res) => {
    const { portfolio } = req.body;
    if (!portfolio) return res.status(400).json({ error: '포트폴리오 데이터가 없습니다.' });
    try {
      const holdingsList = Array.isArray(portfolio)
        ? portfolio
        : (portfolio.holdings ?? ensureArray(portfolio));

      const withWeights = calcWeights(holdingsList);
      const withMarket  = withWeights.map(h => ({ ...h, market: classifyMarket(h) }));

      const totalValue        = portfolio.totalValue ?? holdingsList.reduce((s, h) => s + (h.currentValue ?? h.totalValue ?? 0), 0);
      const profitLossPercent = portfolio.profitLossPercent ?? 0;
      const exchangeRate      = portfolio.exchangeRate ?? 1380;

      const holdingLines = withMarket
        .map(h => `  - ${h.ticker}(${h.category ?? h.market}): 평가금액 ${fmt만원(h.currentValue ?? h.totalValue ?? 0)}, 비중 ${h.currentWeight}%, 수익률 ${(h.profitLossPercent ?? 0).toFixed(1)}%`)
        .join('\n');

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: PORTFOLIO_ANALYSIS_SYSTEM,
        messages: [{
          role: 'user',
          content: `내 포트폴리오를 분석해줘.

포트폴리오 정보:
- 총 평가금액: ${fmt만원(totalValue)}
- 총 수익률: ${profitLossPercent.toFixed(2)}%
- 환율: ${exchangeRate}원/USD
- 종목 수: ${withMarket.length}개
종목 목록:
${holdingLines}

반드시 아래 JSON 형식으로만 응답해 (코드블록 없이 순수 JSON만):
{"summary":"한줄요약","metrics":[{"label":"분산도","score":85,"cardSummary":"요약","detail":"상세","color":"green"}],"structure":[{"cardSummary":"요약","detail":"상세"}],"cautions":[{"cardSummary":"요약","detail":"상세"}],"notes":[{"cardSummary":"요약","detail":"상세"}]}

[작성 규칙]
- metrics 3~4개, score 0~100, color: 80+ green, 60~79 blue, 40~59 orange, 39- red
- 모든 항목에 cardSummary(1줄)와 detail(2~4문장) 포함
- structure 2~3개, cautions 2~3개, notes 2~3개
- 매수/매도 추천 절대 금지`
        }]
      });
      const raw = response.content[0]?.text?.trim() ?? '';
      const parsed = parseJSON(raw);
      if (parsed && parsed.summary) {
        if (parsed.risks && !parsed.cautions) {
          parsed.cautions = parsed.risks;
          delete parsed.risks;
        }
        res.json(parsed);
      } else {
        console.error('[portfolio-comment] parse failed, raw:', raw.slice(0, 300));
        res.json({ reply: raw });
      }
    } catch (err) {
      console.error('[Claude] portfolio-comment error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ── 5. AI 절세 어드바이저 (Opus) ──────────────
  router.post('/tax-advice', async (req, res) => {
    const { portfolio } = req.body;
    if (!portfolio) return res.status(400).json({ error: '포트폴리오 데이터가 없습니다.' });
    try {
      const {
        byAccount            = [],
        holdings             = [],
        totalTax             = 0,
        totalTaxSaved        = 0,
        annualDividendTotal  = 0,
        comprehensiveTaxRisk = false,
        exchangeRate         = 1380,
      } = portfolio;

      const accountLines = byAccount.map(a =>
        `  - ${a.label}(${a.accountType}): 평가금액 ${fmt만원(a.totalValue)}, ` +
        `평가손익 ${fmt만원(a.unrealizedGain)}, 양도세 ${fmt만원(a.capitalGainsTax)}, ` +
        `배당세 ${fmt만원(a.dividendTax)}, ${a.holdingCount}종목`
      ).join('\n') || '  (정보 없음)';

      const losingHoldings = holdings
        .filter(h => h.unrealizedGainKRW < 0 && h.accountType === 'REGULAR')
        .sort((a, b) => a.unrealizedGainKRW - b.unrealizedGainKRW)
        .slice(0, 5);

      const losingLines = losingHoldings.length > 0
        ? losingHoldings.map(h =>
            `  - ${h.ticker}(${h.currency}): 손실 ${fmt만원(Math.abs(h.unrealizedGainKRW))}, 수익률 ${(h.profitLossPercent ?? 0).toFixed(1)}%`
          ).join('\n')
        : '  (손실 종목 없음)';

      const gainingRegular = holdings
        .filter(h => h.unrealizedGainKRW > 0 && h.accountType === 'REGULAR')
        .sort((a, b) => b.unrealizedGainKRW - a.unrealizedGainKRW)
        .slice(0, 5);

      const gainingLines = gainingRegular.length > 0
        ? gainingRegular.map(h =>
            `  - ${h.ticker}(${h.currency}): 수익 ${fmt만원(h.unrealizedGainKRW)}, 수익률 ${(h.profitLossPercent ?? 0).toFixed(1)}%`
          ).join('\n')
        : '  (일반계좌 수익 종목 없음)';

      const topDividend = holdings
        .filter(h => h.annualDividendKRW > 0)
        .sort((a, b) => b.annualDividendKRW - a.annualDividendKRW)
        .slice(0, 5);

      const dividendLines = topDividend.length > 0
        ? topDividend.map(h =>
            `  - ${h.ticker}(${h.accountType}): 연배당 ${fmt만원(h.annualDividendKRW)}`
          ).join('\n')
        : '  (배당 종목 없음)';

      const regularDividendTotal = topDividend
        .filter(h => h.accountType === 'REGULAR')
        .reduce((s, h) => s + h.annualDividendKRW, 0);

      const firstGainTicker     = gainingRegular.length > 0 ? gainingRegular[0].ticker : '수익 종목';
      const firstDividendTicker = topDividend.length > 0 ? topDividend[0].ticker : '배당 종목';
      const losingTickers       = losingHoldings.map(h => h.ticker).join(', ') || '없음';

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 5000,
        system: TAX_SYSTEM,
        messages: [{
          role: 'user',
          content: `포트폴리오 절세 분석을 해줘. 아래 데이터를 바탕으로 4가지 절세 전략을 구체적으로 작성해.

== 포트폴리오 현황 ==
환율: ${exchangeRate}원/USD
예상 세금 합계: ${fmt만원(totalTax)}
기절세액: ${fmt만원(totalTaxSaved)}
연간 배당금: ${fmt만원(annualDividendTotal)}${comprehensiveTaxRisk ? ' ⚠️ 종합과세 위험(2,000만원 초과)' : ''}

계좌별 현황:
${accountLines}

일반계좌 손실 종목 (세금 상계 후보):
${losingLines}

일반계좌 수익 종목 (ISA 이전 후보):
${gainingLines}

배당 상위 종목:
${dividendLines}

== 응답 스키마 ==
코드블록 없이 순수 JSON만 출력. 아래 구조를 정확히 따를 것:

{
  "summary": {
    "totalEstimatedTax": ${totalTax},
    "potentialSaving": 절감가능금액숫자,
    "annualDividend": ${annualDividendTotal},
    "unrealizedGain": 총평가손익숫자,
    "overseasCount": 해외종목수숫자,
    "domesticCount": 국내종목수숫자
  },
  "strategies": [
    {
      "rank": 1,
      "cardSummary": "ISA 계좌로 배당주 이전해 배당세 절감",
      "title": "ISA 계좌 활용",
      "category": "isa",
      "expectedSaving": 절감예상금액숫자,
      "difficulty": "medium",
      "detail": {
        "whatIs": "ISA는 운용수익 200만원까지 비과세, 초과분 9.9% 분리과세로 일반계좌보다 유리. 연 납입한도 2000만원.",
        "howItHelps": "${firstGainTicker} 등 이 포트폴리오 기준 구체적 절세 효과",
        "limitation": "연 납입한도 2000만원. 의무가입 3년. 해외주식 직접 매매 불가.",
        "steps": [
          { "step": 1, "title": "ISA 계좌 개설", "description": "증권사 앱에서 ISA 중개형 개설" },
          { "step": 2, "title": "이전 종목 선정", "description": "${firstGainTicker} 매도 후 ISA에서 TIGER 미국S&P500 등으로 대체" },
          { "step": 3, "title": "배당주 ETF 편입", "description": "ISA 내에서 TIGER 미국배당다우존스 등 운용" }
        ],
        "warning": "해외주식 직접 이전 불가. 매도 재매수 시 환율 타이밍 리스크 존재"
      }
    },
    {
      "rank": 2,
      "cardSummary": "${losingHoldings.length > 0 ? losingTickers + ' 매도로 양도세 상계' : '손실 종목 매도로 양도세 절감'}",
      "title": "손실종목 매도 (Tax-Loss Harvesting)",
      "category": "tax_loss",
      "expectedSaving": 손실매도절감세액숫자,
      "difficulty": "easy",
      "detail": {
        "whatIs": "올해 실현한 해외주식 양도차익과 손실을 같은 해에 통산해 순 과세 소득을 줄이는 전략.",
        "howItHelps": "${losingHoldings.length > 0 ? '현재 손실 종목 ' + losingTickers + ' 의 손실을 실현하면 수익 종목 양도차익과 상계 가능' : '현재 손실 종목 없음. 연말 재검토 권장'}",
        "limitation": "12월 결산 전 매도해야 당해년도 반영. 동일 종목 즉시 재매수 시 절세 효과 없음.",
        "steps": [
          { "step": 1, "title": "손실 종목 파악", "description": "현재 손실: ${losingLines.replace(/\n/g, ' / ')}" },
          { "step": 2, "title": "매도 타이밍", "description": "12월 중순까지 매도 완료해야 결제일 T+2 기준으로 당해년도 손실 인정" },
          { "step": 3, "title": "포지션 유지", "description": "유사 ETF로 즉시 교체 매수 가능 (예: VOO를 매도하면 SPY로 재매수)" }
        ],
        "warning": "${losingHoldings.length > 0 ? '장기 보유 전략과의 충돌 여부 검토 필요' : null}"
      }
    },
    {
      "rank": 3,
      "cardSummary": "IRP 추가납입으로 연 최대 115만5천원 세액공제",
      "title": "IRP/연금저축 추가납입",
      "category": "irp",
      "expectedSaving": 세액공제예상금액숫자,
      "difficulty": "easy",
      "detail": {
        "whatIs": "IRP와 연금저축 합산 연 700만원까지 납입 시 세액공제. 총급여 5500만원 이하 16.5%, 초과 13.2% 공제율.",
        "howItHelps": "연 700만원 납입 기준 최대 115만5천원 직접 세액공제. 운용 중 세금 없음.",
        "limitation": "55세 이전 중도 해지 시 기타소득세 16.5% 부과. IRP는 위험자산 70% 한도.",
        "steps": [
          { "step": 1, "title": "연금저축 vs IRP 비교", "description": "연금저축은 주식 100% 투자 가능. IRP는 위험자산 70% 한도. 연금저축 400만 + IRP 300만 조합 권장" },
          { "step": 2, "title": "납입 한도 확인", "description": "연금저축 연 600만원 + IRP 합산 900만원 한도에서 남은 금액 채우기" },
          { "step": 3, "title": "ETF 선택", "description": "TIGER 미국S&P500 KODEX 미국나스닥100 등 국내 상장 해외지수 ETF 편입 가능" }
        ],
        "warning": "IRP 위험자산 70% 한도 규정 있음. 55세 이후 10년 이상 연금 수령 시 세율 우대"
      }
    },
    {
      "rank": 4,
      "cardSummary": "${comprehensiveTaxRisk ? '배당소득 분산해 종합과세 위험 해소' : '배당소득 관리로 종합과세 예방'}",
      "title": "배당소득 분산 관리",
      "category": "dividend",
      "expectedSaving": 배당세절감예상금액숫자,
      "difficulty": "medium",
      "detail": {
        "whatIs": "국내외 배당소득이 연 2000만원을 초과하면 다른 소득과 합산 종합과세 최대 49.5%. ISA 배당은 비과세/분리과세로 종합과세 대상 제외.",
        "howItHelps": "현재 일반계좌 연배당 ${fmt만원(regularDividendTotal)}. ${comprehensiveTaxRisk ? '이미 종합과세 구간. ' + firstDividendTicker + ' 등을 ISA로 이전 필수' : '아직 2000만원 미만. ISA 이전으로 배당세 15.4%에서 9.9%로 절감 가능'}",
        "limitation": "ISA 해외주식 직접 투자 불가. 국내 상장 배당 ETF로 대체 필요.",
        "steps": [
          { "step": 1, "title": "배당소득 현황 파악", "description": "일반계좌 연배당 ${fmt만원(regularDividendTotal)}. 2000만원 한도까지 여유분 확인" },
          { "step": 2, "title": "고배당 종목 ISA 이전", "description": "${firstDividendTicker} 등 고배당 종목 매도 후 ISA에서 국내 상장 배당 ETF로 대체" },
          { "step": 3, "title": "해외 배당주 대체", "description": "SCHD는 TIGER 미국배당다우존스로 ISA 내 운용" }
        ],
        "warning": "${comprehensiveTaxRisk ? '현재 배당소득 종합과세 대상. 세무사 상담 강력 권장' : null}"
      }
    }
  ],
  "alerts": [
    ${comprehensiveTaxRisk
      ? '{ "type": "warning", "cardSummary": "배당소득 종합과세 위험", "detail": "연간 배당소득이 2000만원을 초과해 종합과세 대상입니다. 최고세율 49.5%까지 적용될 수 있어 즉각적인 대응이 필요합니다." }'
      : '{ "type": "info", "cardSummary": "해외주식 양도세 250만원 공제 활용", "detail": "해외주식 양도차익은 연 250만원까지 공제됩니다. 매년 250만원 이하로 수익 실현을 분산하면 양도소득세를 0원으로 유지할 수 있습니다." }'
    }
  ]
}

위 스키마를 기반으로 이 포트폴리오에 맞는 구체적인 내용으로 채워서 응답하세요. 숫자 필드는 따옴표 없이 숫자로만 작성하세요.`
        }]
      });

      const raw = response.content[0]?.text?.trim() ?? '';
      const parsed = parseJSON(raw);
      if (parsed && parsed.summary && parsed.strategies) {
        res.json(parsed);
      } else {
        console.error('[tax-advice] parse failed, raw:', raw.slice(0, 300));
        res.json({ advice: raw });
      }
    } catch (err) {
      console.error('[Claude] tax-advice error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ── 6. 리밸런싱 가이드 ─────────────────────
  router.post('/rebalance-guide', async (req, res) => {
    const { portfolio: rawPortfolio, targets, investableAmount } = req.body;
    if (!rawPortfolio || !targets) {
      return res.status(400).json({ error: 'portfolio와 targets이 필요합니다.' });
    }
    try {
      const portfolio = ensureArray(rawPortfolio);
      const totalValue = portfolio.reduce((sum, h) => sum + (h.totalValue || 0), 0);
      const deviations = [];
      const tickerMap = {};
      portfolio.forEach(h => { tickerMap[h.ticker] = h.totalValue || 0; });

      for (const [ticker, targetPct] of Object.entries(targets)) {
        const currentValue = tickerMap[ticker] || 0;
        const currentPct = totalValue > 0 ? Math.round((currentValue / totalValue) * 10000) / 100 : 0;
        const gap = Math.round((currentPct - targetPct) * 100) / 100;
        const gapAmount = Math.round(totalValue * (gap / 100));
        deviations.push({ ticker, targetPct, currentPct, gap, gapAmount, currentValue });
      }
      deviations.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: REBALANCE_SYSTEM,
        messages: [{
          role: 'user',
          content: `리밸런싱 분석. 코드블록 없이 순수 JSON만:
{"summary":"요약","overallScore":78,"items":[{"ticker":"VOO","targetPct":30,"currentPct":21.6,"gap":-8.4,"gapAmount":-4840,"status":"under","priority":"high"}],"comment":"코멘트"}

status: over/under/ok, priority: high(5%p+)/medium(2~5%p)/low(2%p-)${investableAmount ? `\n추가투입가능: $${investableAmount}` : ''}

총평가액: $${totalValue}
데이터: ${JSON.stringify(deviations, null, 2)}`
        }]
      });
      const raw = response.content[0]?.text?.trim() ?? '';
      const parsed = parseJSON(raw);
      if (parsed && parsed.items) {
        parsed.items = parsed.items.map(item => {
          const calc = deviations.find(d => d.ticker === item.ticker);
          if (calc) { Object.assign(item, { targetPct: calc.targetPct, currentPct: calc.currentPct, gap: calc.gap, gapAmount: calc.gapAmount }); }
          return item;
        });
        parsed.totalValue = totalValue;
        res.json(parsed);
      } else {
        res.json({ summary: raw, overallScore: 0, items: deviations, comment: '', totalValue });
      }
    } catch (err) {
      console.error('[Claude] rebalance-guide error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  // ── 7. 주간/월간 AI 리포트 ─────────────────
  router.post('/portfolio-report', async (req, res) => {
    const { period, portfolio, changes, dividends, marketContext } = req.body;
    if (!period || !portfolio || !changes) {
      return res.status(400).json({ error: 'period, portfolio, changes가 필요합니다.' });
    }
    try {
      const periodLabel = period.type === 'weekly' ? '주간' : '월간';
      const response = await client.messages.create({
        model: OPUS_MODEL,
        max_tokens: 2500,
        system: REPORT_SYSTEM,
        messages: [{
          role: 'user',
          content: `${periodLabel} 리포트. 코드블록 없이 순수 JSON만:
{"title":"${periodLabel} 리포트 (${period.startDate}~${period.endDate})","sections":[{"heading":"제목","body":"본문"}],"keyNumbers":[{"label":"총수익률","value":"+1.2%","color":"green"}]}

[규칙] 성찰적 톤 금지. 숫자/팩트만. sections 3~5개.

데이터:
- 기간: ${period.startDate} ~ ${period.endDate}
- 포트폴리오: ${JSON.stringify(portfolio, null, 2)}
- 변동: ${JSON.stringify(changes, null, 2)}
${dividends ? `- 배당: ${JSON.stringify(dividends, null, 2)}` : '- 배당: 없음'}
${marketContext ? `- 시장: ${JSON.stringify(marketContext, null, 2)}` : '- 시장: 없음'}`
        }]
      });
      const raw = response.content[0]?.text?.trim() ?? '';
      const parsed = parseJSON(raw);
      if (parsed && parsed.sections) {
        let markdown = `# ${parsed.title}\n\n`;
        for (const sec of parsed.sections) { markdown += `## ${sec.heading}\n\n${sec.body}\n\n`; }
        parsed.markdown = markdown;
        res.json(parsed);
      } else {
        res.json({ title: '', sections: [], keyNumbers: [], markdown: '' });
      }
    } catch (err) {
      console.error('[Claude] portfolio-report error:', err.message);
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createClaudeRouter };