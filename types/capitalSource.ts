// Capital source tracking — preserves investment origin through reinvestments

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum CapitalSourceType {
  PRINCIPAL    = 'principal',    // 사용자 직접 납입 원금
  DIVIDEND     = 'dividend',     // 배당 재투자
  INTEREST     = 'interest',     // 채권/RP 이자 재투자
  CAPITAL_GAIN = 'capital_gain', // 매도차익 재투자
  TRANSFER     = 'transfer',     // 계좌 이동 자금
}

export enum TransactionType {
  BUY      = 'buy',
  SELL     = 'sell',
  DIVIDEND = 'dividend',
  INTEREST = 'interest',
  TRANSFER = 'transfer',
}

// ── Core Models ───────────────────────────────────────────────────────────────

/** Atomic unit of invested capital — one lot = one source origin */
export interface CapitalLot {
  readonly id: string;
  sourceType: CapitalSourceType;
  amount: number;                    // KRW
  createdAt: string;                 // ISO 8601
  originTransactionId?: string;      // 배당/이자/매도 트랜잭션 ID
}

/** Capital-aware holding — extends the base Holding concept */
export interface CapitalHolding {
  readonly id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: 'KRW' | 'USD';
  capitalLots: CapitalLot[];         // sum(lot.amount) === totalCost
}

/** Full audit trail entry for every capital movement */
export interface Transaction {
  readonly id: string;
  accountId: string;
  type: TransactionType;
  symbol?: string;
  amount: number;                    // KRW
  quantity?: number;
  price?: number;
  currency: 'KRW' | 'USD';
  date: string;                      // ISO 8601
  capitalSource?: CapitalSourceType;
  linkedLotIds?: string[];           // lots created or consumed by this tx
}

// ── Analytics Models ──────────────────────────────────────────────────────────

export interface PortfolioCapitalSummary {
  principal: number;
  dividendReinvested: number;
  interestReinvested: number;
  capitalGainReinvested: number;
  transferIn: number;
  total: number;
}

export interface HoldingCapitalBreakdown {
  holdingId: string;
  principalRatio: number;            // 0–1
  dividendRatio: number;
  interestRatio: number;
  gainRatio: number;
  transferRatio: number;
  totalCapital: number;              // KRW
}

// ── Lot Factory Helpers ───────────────────────────────────────────────────────

export function createPrincipalLot(amount: number): CapitalLot {
  return { id: uuidv4(), sourceType: CapitalSourceType.PRINCIPAL, amount, createdAt: new Date().toISOString() };
}

export function createDividendLot(amount: number, originTransactionId: string): CapitalLot {
  return { id: uuidv4(), sourceType: CapitalSourceType.DIVIDEND, amount, createdAt: new Date().toISOString(), originTransactionId };
}

export function createInterestLot(amount: number, originTransactionId: string): CapitalLot {
  return { id: uuidv4(), sourceType: CapitalSourceType.INTEREST, amount, createdAt: new Date().toISOString(), originTransactionId };
}

export function createCapitalGainLot(amount: number, originTransactionId: string): CapitalLot {
  return { id: uuidv4(), sourceType: CapitalSourceType.CAPITAL_GAIN, amount, createdAt: new Date().toISOString(), originTransactionId };
}

export function createTransferLot(amount: number, originTransactionId?: string): CapitalLot {
  return { id: uuidv4(), sourceType: CapitalSourceType.TRANSFER, amount, createdAt: new Date().toISOString(), originTransactionId };
}

// ── Reinvestment Inheritance ──────────────────────────────────────────────────

/**
 * When selling asset A and buying asset B, call this to inherit the source
 * composition of the sold position into the new position.
 *
 * Example:
 *   A was 70% principal + 30% dividend → B receives same 70/30 ratio
 */
export function inheritCapitalLots(
  sourceLots: CapitalLot[],
  newTotalAmount: number,
  originTransactionId: string,
): CapitalLot[] {
  const sourceTotal = sumLots(sourceLots);
  if (sourceTotal === 0 || sourceLots.length === 0) {
    return [createPrincipalLot(newTotalAmount)];
  }

  // Group by source type, then scale proportionally to newTotalAmount
  const grouped = groupLotsBySource(sourceLots);
  const now = new Date().toISOString();

  return Object.entries(grouped)
    .filter(([, total]) => total > 0)
    .map(([sourceType, total]) => ({
      id: uuidv4(),
      sourceType: sourceType as CapitalSourceType,
      amount: (total / sourceTotal) * newTotalAmount,
      createdAt: now,
      originTransactionId,
    }));
}

/**
 * Partial sell: consume lots proportionally, return the residual lots
 * that remain in the position after the sell.
 *
 * @param lots     existing capital lots for the holding
 * @param sellRatio fraction of the position sold (0–1)
 * @returns        { remaining, sold } — both preserve source composition
 */
export function partialSellLots(
  lots: CapitalLot[],
  sellRatio: number,
): { remaining: CapitalLot[]; sold: CapitalLot[] } {
  const keepRatio = 1 - sellRatio;
  const now = new Date().toISOString();

  const remaining: CapitalLot[] = lots.map(lot => ({
    ...lot,
    id: uuidv4(),
    amount: lot.amount * keepRatio,
    createdAt: now,
  }));

  const sold: CapitalLot[] = lots.map(lot => ({
    ...lot,
    id: uuidv4(),
    amount: lot.amount * sellRatio,
    createdAt: now,
  }));

  return { remaining, sold };
}

// ── Analytics Functions ───────────────────────────────────────────────────────

export function calculateCapitalSummary(holdings: CapitalHolding[]): PortfolioCapitalSummary {
  const summary: PortfolioCapitalSummary = {
    principal: 0,
    dividendReinvested: 0,
    interestReinvested: 0,
    capitalGainReinvested: 0,
    transferIn: 0,
    total: 0,
  };

  for (const holding of holdings) {
    for (const lot of holding.capitalLots) {
      switch (lot.sourceType) {
        case CapitalSourceType.PRINCIPAL:    summary.principal            += lot.amount; break;
        case CapitalSourceType.DIVIDEND:     summary.dividendReinvested   += lot.amount; break;
        case CapitalSourceType.INTEREST:     summary.interestReinvested   += lot.amount; break;
        case CapitalSourceType.CAPITAL_GAIN: summary.capitalGainReinvested += lot.amount; break;
        case CapitalSourceType.TRANSFER:     summary.transferIn           += lot.amount; break;
      }
    }
  }

  summary.total =
    summary.principal +
    summary.dividendReinvested +
    summary.interestReinvested +
    summary.capitalGainReinvested +
    summary.transferIn;

  return summary;
}

export function getHoldingCapitalBreakdown(holding: CapitalHolding): HoldingCapitalBreakdown {
  const grouped = groupLotsBySource(holding.capitalLots);
  const total   = sumLots(holding.capitalLots);
  const ratio   = (src: CapitalSourceType) => total > 0 ? (grouped[src] ?? 0) / total : 0;

  return {
    holdingId:       holding.id,
    principalRatio:  ratio(CapitalSourceType.PRINCIPAL),
    dividendRatio:   ratio(CapitalSourceType.DIVIDEND),
    interestRatio:   ratio(CapitalSourceType.INTEREST),
    gainRatio:       ratio(CapitalSourceType.CAPITAL_GAIN),
    transferRatio:   ratio(CapitalSourceType.TRANSFER),
    totalCapital:    total,
  };
}

/** Human-readable primary source label for UI display */
export function getPrimarySourceLabel(breakdown: HoldingCapitalBreakdown): string {
  const entries: [CapitalSourceType, number][] = [
    [CapitalSourceType.PRINCIPAL,    breakdown.principalRatio],
    [CapitalSourceType.DIVIDEND,     breakdown.dividendRatio],
    [CapitalSourceType.INTEREST,     breakdown.interestRatio],
    [CapitalSourceType.CAPITAL_GAIN, breakdown.gainRatio],
    [CapitalSourceType.TRANSFER,     breakdown.transferRatio],
  ];

  const dominant = entries.reduce((a, b) => (b[1] > a[1] ? b : a));

  const LABELS: Record<CapitalSourceType, string> = {
    [CapitalSourceType.PRINCIPAL]:    '내 돈 투자',
    [CapitalSourceType.DIVIDEND]:     '배당으로 산 자산',
    [CapitalSourceType.INTEREST]:     '이자로 산 자산',
    [CapitalSourceType.CAPITAL_GAIN]: '차익으로 산 자산',
    [CapitalSourceType.TRANSFER]:     '이전된 자산',
  };

  return LABELS[dominant[0]];
}

// ── UI Display Constants ──────────────────────────────────────────────────────

export const CAPITAL_SOURCE_LABELS: Record<CapitalSourceType, string> = {
  [CapitalSourceType.PRINCIPAL]:    '원금',
  [CapitalSourceType.DIVIDEND]:     '배당재투자',
  [CapitalSourceType.INTEREST]:     '이자재투자',
  [CapitalSourceType.CAPITAL_GAIN]: '차익재투자',
  [CapitalSourceType.TRANSFER]:     '계좌이전',
};

export const CAPITAL_SOURCE_COLORS: Record<CapitalSourceType, string> = {
  [CapitalSourceType.PRINCIPAL]:    '#6B4FFF',
  [CapitalSourceType.DIVIDEND]:     '#00C896',
  [CapitalSourceType.INTEREST]:     '#FF9500',
  [CapitalSourceType.CAPITAL_GAIN]: '#FF6B6B',
  [CapitalSourceType.TRANSFER]:     '#5AC8FA',
};

/** 재원 비율 항목 — 여러 출처의 비율을 합산 100으로 저장 */
export interface CapitalMixEntry {
  source: CapitalSourceType;
  ratio: number; // 0–100, 모든 항목 합산 = 100
}

/** 피커에 표시할 선택지 (TRANSFER 제외) */
export const CAPITAL_SOURCE_OPTIONS: CapitalSourceType[] = [
  CapitalSourceType.PRINCIPAL,
  CapitalSourceType.DIVIDEND,
  CapitalSourceType.INTEREST,
  CapitalSourceType.CAPITAL_GAIN,
];

// ── Internal Helpers ──────────────────────────────────────────────────────────

function sumLots(lots: CapitalLot[]): number {
  return lots.reduce((acc, lot) => acc + lot.amount, 0);
}

function groupLotsBySource(lots: CapitalLot[]): Partial<Record<CapitalSourceType, number>> {
  const result: Partial<Record<CapitalSourceType, number>> = {};
  for (const lot of lots) {
    result[lot.sourceType] = (result[lot.sourceType] ?? 0) + lot.amount;
  }
  return result;
}
