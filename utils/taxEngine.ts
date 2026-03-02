/**
 * taxEngine.ts
 * 한국 투자자를 위한 절세 계산 엔진
 *
 * 지원 계좌: 일반, ISA, 연금저축, IRP, 퇴직연금
 */

import { EnrichedHolding, AccountType, ACCOUNT_TYPE_LABELS } from '../types/portfolio';

// ── 상수 ─────────────────────────────────────────────────────
/** 해외주식 양도소득세율 */
const FOREIGN_CAPITAL_GAINS_RATE = 0.22;
/** 해외주식 양도소득 기본공제 (250만원) */
const CAPITAL_GAINS_DEDUCTION = 2_500_000;
/** 배당소득세율 (원천징수) */
const DIVIDEND_TAX_RATE = 0.154;
/** 금융소득 종합과세 기준 (2,000만원) */
const COMPREHENSIVE_TAX_THRESHOLD = 20_000_000;
/** ISA 비과세 한도 (일반형 200만, 서민형 400만) */
const ISA_EXEMPT_LIMIT = 2_000_000;
/** ISA 초과분 세율 */
const ISA_EXCESS_RATE = 0.099;
/** ISA 연간 납입 한도 */
const ISA_ANNUAL_LIMIT = 20_000_000;
/** 연금저축 세액공제 한도 */
const PENSION_CREDIT_LIMIT = 4_000_000;
/** 연금저축+IRP 합산 세액공제 한도 */
const PENSION_IRP_COMBINED_LIMIT = 7_000_000;
/** 세액공제율 (총급여 5,500만 이하: 16.5%, 초과: 13.2%) */
const TAX_CREDIT_RATE_HIGH = 0.165;
const TAX_CREDIT_RATE_LOW = 0.132;

// ── 결과 타입 ─────────────────────────────────────────────────
export interface AccountTaxResult {
  accountType: AccountType;
  label: string;
  holdingCount: number;
  totalValue: number;       // 현재 평가액 (KRW)
  totalCost: number;        // 총 매수금액 (KRW)
  unrealizedGain: number;   // 평가손익 (KRW)
  annualDividend: number;   // 연간 예상 배당금 (KRW)
  capitalGainsTax: number;  // 양도소득세 예상액
  dividendTax: number;      // 배당소득세 예상액
  totalTax: number;
  taxSavedVsRegular: number; // 일반계좌 대비 절세액
  description: string;      // 세금 설명
}

export interface PensionTaxCredit {
  pensionContribution: number;  // 연금저축 납입한도 기준
  irpContribution: number;      // IRP 납입한도 기준
  totalContribution: number;
  creditRateNote: string;
  maxCreditHigh: number;  // 총급여 5,500만 이하 시 최대 공제액
  maxCreditLow: number;   // 총급여 5,500만 초과 시 최대 공제액
}

export interface TaxSummary {
  byAccount: AccountTaxResult[];
  totalCapitalGainsTax: number;
  totalDividendTax: number;
  totalTax: number;
  totalTaxSaved: number;
  pensionTaxCredit: PensionTaxCredit;
  annualDividendTotal: number;
  comprehensiveTaxRisk: boolean; // 배당소득이 2,000만원 초과 시 true
  tips: string[];
}

// ── 헬퍼 ─────────────────────────────────────────────────────
function isKoreanStock(ticker: string): boolean {
  return ticker.endsWith('.KS') || ticker.endsWith('.KQ');
}

function calcAnnualDividend(holdings: EnrichedHolding[], usdKrwRate: number): number {
  let total = 0;
  for (const h of holdings) {
    for (const d of h.dividends) {
      const perShareKRW = d.currency === 'KRW' ? d.amount : d.amount * usdKrwRate;
      const times =
        d.frequency === 'MONTHLY' ? 12
        : d.frequency === 'QUARTERLY' ? 4
        : d.frequency === 'SEMI_ANNUAL' ? 2
        : 1;
      total += perShareKRW * times * h.quantity;
    }
  }
  return total;
}

function calcRegularTax(
  holdings: EnrichedHolding[],
  usdKrwRate: number,
): { capitalGainsTax: number; dividendTax: number; annualDividend: number } {
  // 해외주식 평가차익 합산
  const foreignGain = holdings
    .filter(h => !isKoreanStock(h.ticker) && h.profitLoss > 0)
    .reduce((s, h) => s + h.profitLoss, 0);

  const taxableGain = Math.max(0, foreignGain - CAPITAL_GAINS_DEDUCTION);
  const capitalGainsTax = Math.round(taxableGain * FOREIGN_CAPITAL_GAINS_RATE);

  const annualDividend = calcAnnualDividend(holdings, usdKrwRate);
  const dividendTax = Math.round(annualDividend * DIVIDEND_TAX_RATE);

  return { capitalGainsTax, dividendTax, annualDividend };
}

// ── 메인 계산 함수 ─────────────────────────────────────────────
export function calculateTaxSummary(
  holdings: EnrichedHolding[],
  usdKrwRate: number,
): TaxSummary {
  // 계좌별 그룹핑 (accountType 없는 구형 데이터는 REGULAR로)
  const groups: Record<AccountType, EnrichedHolding[]> = {
    REGULAR: [],
    ISA: [],
    PENSION: [],
    IRP: [],
    RETIREMENT: [],
  };

  for (const h of holdings) {
    const acct: AccountType = h.accountType ?? 'REGULAR';
    groups[acct].push(h);
  }

  const results: AccountTaxResult[] = [];

  // ─── 일반계좌 ───
  if (groups.REGULAR.length > 0) {
    const hs = groups.REGULAR;
    const totalValue = hs.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = hs.reduce((s, h) => s + h.totalCost, 0);
    const unrealizedGain = totalValue - totalCost;
    const { capitalGainsTax, dividendTax, annualDividend } = calcRegularTax(hs, usdKrwRate);

    results.push({
      accountType: 'REGULAR',
      label: ACCOUNT_TYPE_LABELS.REGULAR,
      holdingCount: hs.length,
      totalValue, totalCost, unrealizedGain, annualDividend,
      capitalGainsTax, dividendTax,
      totalTax: capitalGainsTax + dividendTax,
      taxSavedVsRegular: 0,
      description: '해외주식 양도소득세 22% (250만 공제) · 배당소득세 15.4%',
    });
  }

  // ─── ISA ───
  if (groups.ISA.length > 0) {
    const hs = groups.ISA;
    const totalValue = hs.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = hs.reduce((s, h) => s + h.totalCost, 0);
    const unrealizedGain = totalValue - totalCost;
    const annualDividend = calcAnnualDividend(hs, usdKrwRate);

    // ISA: 운용수익 중 비과세 200만, 초과분 9.9%
    const totalProfit = Math.max(0, unrealizedGain) + annualDividend;
    const taxable = Math.max(0, totalProfit - ISA_EXEMPT_LIMIT);
    const dividendTax = Math.round(taxable * ISA_EXCESS_RATE);

    // 일반계좌였다면
    const { capitalGainsTax: regCapital, dividendTax: regDividend } = calcRegularTax(hs, usdKrwRate);
    const taxSavedVsRegular = Math.max(0, regCapital + regDividend - dividendTax);

    results.push({
      accountType: 'ISA',
      label: ACCOUNT_TYPE_LABELS.ISA,
      holdingCount: hs.length,
      totalValue, totalCost, unrealizedGain, annualDividend,
      capitalGainsTax: 0, dividendTax,
      totalTax: dividendTax,
      taxSavedVsRegular,
      description: `비과세 ${(ISA_EXEMPT_LIMIT / 10000).toFixed(0)}만원 · 초과분 ${(ISA_EXCESS_RATE * 100).toFixed(1)}% 분리과세`,
    });
  }

  // ─── 연금저축 ───
  if (groups.PENSION.length > 0) {
    const hs = groups.PENSION;
    const totalValue = hs.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = hs.reduce((s, h) => s + h.totalCost, 0);
    const unrealizedGain = totalValue - totalCost;
    const annualDividend = calcAnnualDividend(hs, usdKrwRate);

    const { capitalGainsTax: regCapital, dividendTax: regDividend } = calcRegularTax(hs, usdKrwRate);
    const taxSavedVsRegular = regCapital + regDividend; // 운용 중 세금 0

    results.push({
      accountType: 'PENSION',
      label: ACCOUNT_TYPE_LABELS.PENSION,
      holdingCount: hs.length,
      totalValue, totalCost, unrealizedGain, annualDividend,
      capitalGainsTax: 0, dividendTax: 0,
      totalTax: 0,
      taxSavedVsRegular,
      description: '운용 중 세금 없음 · 연금수령 시 3.3~5.5% 연금소득세',
    });
  }

  // ─── IRP ───
  if (groups.IRP.length > 0) {
    const hs = groups.IRP;
    const totalValue = hs.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = hs.reduce((s, h) => s + h.totalCost, 0);
    const unrealizedGain = totalValue - totalCost;
    const annualDividend = calcAnnualDividend(hs, usdKrwRate);

    const { capitalGainsTax: regCapital, dividendTax: regDividend } = calcRegularTax(hs, usdKrwRate);
    const taxSavedVsRegular = regCapital + regDividend;

    results.push({
      accountType: 'IRP',
      label: ACCOUNT_TYPE_LABELS.IRP,
      holdingCount: hs.length,
      totalValue, totalCost, unrealizedGain, annualDividend,
      capitalGainsTax: 0, dividendTax: 0,
      totalTax: 0,
      taxSavedVsRegular,
      description: '운용 중 세금 없음 · 연금수령 시 3.3~5.5% 연금소득세',
    });
  }

  // ─── 퇴직연금 ───
  if (groups.RETIREMENT.length > 0) {
    const hs = groups.RETIREMENT;
    const totalValue = hs.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = hs.reduce((s, h) => s + h.totalCost, 0);
    const unrealizedGain = totalValue - totalCost;
    const annualDividend = calcAnnualDividend(hs, usdKrwRate);

    results.push({
      accountType: 'RETIREMENT',
      label: ACCOUNT_TYPE_LABELS.RETIREMENT,
      holdingCount: hs.length,
      totalValue, totalCost, unrealizedGain, annualDividend,
      capitalGainsTax: 0, dividendTax: 0,
      totalTax: 0,
      taxSavedVsRegular: 0,
      description: '회사 납입 · 과세이연 · 퇴직 시 퇴직소득세',
    });
  }

  // ─── 연금저축/IRP 세액공제 계산 ───
  const hasPension = groups.PENSION.length > 0;
  const hasIRP = groups.IRP.length > 0;

  // 납입한도 기준 (실제 납입액 불명이므로 최대한도 안내)
  const pensionContrib = hasPension ? PENSION_CREDIT_LIMIT : 0;
  const irpContrib = hasIRP
    ? Math.min(
        groups.IRP.reduce((s, h) => s + h.totalCost, 0),
        PENSION_IRP_COMBINED_LIMIT - pensionContrib,
      )
    : 0;
  const totalContrib = pensionContrib + irpContrib;

  const pensionTaxCredit: PensionTaxCredit = {
    pensionContribution: pensionContrib,
    irpContribution: irpContrib,
    totalContribution: totalContrib,
    creditRateNote: '총급여 5,500만 이하 16.5% / 초과 13.2%',
    maxCreditHigh: Math.round(totalContrib * TAX_CREDIT_RATE_HIGH),
    maxCreditLow: Math.round(totalContrib * TAX_CREDIT_RATE_LOW),
  };

  // ─── 집계 ───
  const totalCapitalGainsTax = results.reduce((s, r) => s + r.capitalGainsTax, 0);
  const totalDividendTax = results.reduce((s, r) => s + r.dividendTax, 0);
  const totalTax = totalCapitalGainsTax + totalDividendTax;
  const totalTaxSaved = results.reduce((s, r) => s + r.taxSavedVsRegular, 0);
  const annualDividendTotal = results.reduce((s, r) => s + r.annualDividend, 0);
  const comprehensiveTaxRisk = annualDividendTotal > COMPREHENSIVE_TAX_THRESHOLD;

  // ─── 절세 팁 ───
  const tips: string[] = [];

  if (groups.REGULAR.length > 0) {
    const foreignGain = groups.REGULAR
      .filter(h => !isKoreanStock(h.ticker) && h.profitLoss > 0)
      .reduce((s, h) => s + h.profitLoss, 0);
    if (foreignGain > 0 && foreignGain <= CAPITAL_GAINS_DEDUCTION) {
      tips.push('해외주식 평가차익이 250만원 이하로, 현재 양도소득세가 없습니다.');
    }
    if (foreignGain > CAPITAL_GAINS_DEDUCTION) {
      tips.push('해외주식 수익은 연 250만원까지 양도소득세가 공제됩니다. ISA나 연금저축으로 이전을 고려하세요.');
    }
  }

  if (!hasPension && !hasIRP) {
    tips.push('연금저축 또는 IRP에 납입하면 연간 최대 115.5만원 세액공제 혜택이 있습니다.');
  } else if (hasPension && !hasIRP) {
    tips.push('IRP를 추가하면 연금저축 합산 최대 700만원 납입액에 세액공제를 받을 수 있습니다.');
  }

  if (groups.ISA.length === 0) {
    tips.push('ISA 계좌를 활용하면 운용수익 200만원까지 비과세 혜택을 받을 수 있습니다.');
  }

  if (comprehensiveTaxRisk) {
    tips.push('연간 배당소득이 2,000만원을 초과해 종합과세 대상이 될 수 있습니다. 전문가 상담을 권장합니다.');
  }

  if (tips.length === 0) {
    tips.push('다양한 절세 계좌를 잘 활용하고 계십니다!');
  }

  return {
    byAccount: results,
    totalCapitalGainsTax,
    totalDividendTax,
    totalTax,
    totalTaxSaved,
    pensionTaxCredit,
    annualDividendTotal,
    comprehensiveTaxRisk,
    tips,
  };
}

// ── 포맷 헬퍼 ─────────────────────────────────────────────────
export function formatKRW(amount: number): string {
  if (Math.abs(amount) >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}억원`;
  }
  if (Math.abs(amount) >= 10_000) {
    return `${(amount / 10_000).toFixed(0)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}
