// Account data models for Korean tax-advantaged accounts
// Compatible with the existing Holding/PortfolioSummary pipeline

// ── Enums ────────────────────────────────────────────────────────────────────

export enum AccountType {
  GENERAL    = 'GENERAL',
  ISA        = 'ISA',
  PENSION    = 'PENSION',
  IRP        = 'IRP',
  RETIREMENT = 'RETIREMENT',
}

export enum RetirementPlanType {
  DB = 'DB', // Defined Benefit  (확정급여형)
  DC = 'DC', // Defined Contribution (확정기여형)
}

// ── Base ─────────────────────────────────────────────────────────────────────

export interface BaseAccount {
  readonly id: string;
  name: string;
  type: AccountType;
  provider: string;
  openedAt: Date;
  balance: number;
  readonly currency: 'KRW';
}

// ── ISA ──────────────────────────────────────────────────────────────────────

export interface ISAAccount extends BaseAccount {
  type: AccountType.ISA;
  yearlyContribution: number;
  totalContribution: number;
  remainingLimit: number;     // 연간 납입 한도 잔여 (일반 2000만, 서민형 4000만)
  maturityDate: Date;
  profit: number;
  taxFreeLimit: number;       // 비과세 한도 (일반형 200만, 서민형 400만)
  taxableProfit: number;      // 한도 초과 수익 → 9.9% 분리과세 대상
}

// ── Pension Savings (연금저축) ────────────────────────────────────────────────

export interface PensionAccount extends BaseAccount {
  type: AccountType.PENSION;
  yearlyContribution: number;
  deductibleAmount: number;       // 세액공제 적용 납입액 (최대 600만)
  taxCredit: number;              // 공제율 13.2% / 16.5% 적용 결과
  expectedPensionAge: number;
  expectedMonthlyPension: number;
  totalContribution: number;
  totalProfit: number;
}

// ── IRP ───────────────────────────────────────────────────────────────────────

export interface IRPAccount extends BaseAccount {
  type: AccountType.IRP;
  yearlyContribution: number;
  employerContribution: number;
  totalContribution: number;
  deductibleAmount: number;       // 연금저축 합산 세액공제 한도 900만
  taxCredit: number;
  expectedPensionAge: number;
  expectedMonthlyPension: number;
  deferredTaxBenefit: number;     // 과세이연으로 절감된 세금 누계
}

// ── Employer Retirement (퇴직연금) ────────────────────────────────────────────

export interface RetirementAccount extends BaseAccount {
  type: AccountType.RETIREMENT;
  planType: RetirementPlanType;
  employerContribution: number;
  employeeContribution: number;
  transferableToIRP: number;      // 수령 시 IRP 이전 가능 금액
  expectedRetirementDate: Date;
}

// ── Discriminated Union ───────────────────────────────────────────────────────

export type Account =
  | ISAAccount
  | PensionAccount
  | IRPAccount
  | RetirementAccount;

// ── Account-aware Holding ─────────────────────────────────────────────────────

export interface AccountHolding {
  readonly id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  currency: 'KRW' | 'USD';
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface Portfolio {
  accounts: Account[];
  holdings: AccountHolding[];
}

// ── Tax Engine Interface Support ──────────────────────────────────────────────

export interface AccountTaxInfo {
  accountId: string;
  taxSaved?: number;     // 세액공제 / 비과세로 절감한 세금
  expectedTax?: number;  // 연말 또는 수령 시 예상 세금
  deferredTax?: number;  // 과세이연 누적액 (IRP / 퇴직연금)
}

// ── Type Guards ───────────────────────────────────────────────────────────────

export const isISAAccount        = (a: Account): a is ISAAccount        => a.type === AccountType.ISA;
export const isPensionAccount    = (a: Account): a is PensionAccount    => a.type === AccountType.PENSION;
export const isIRPAccount        = (a: Account): a is IRPAccount        => a.type === AccountType.IRP;
export const isRetirementAccount = (a: Account): a is RetirementAccount => a.type === AccountType.RETIREMENT;
