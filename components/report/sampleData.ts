// ─── Report Sample Data ───────────────────────────────────────────────────────

export const WEEKLY_SAMPLE = {
  period: '2026년 3월 1주차',
  weekLabel: '03.02 월 ~ 03.06 금',
  weekNumber: '2026-W10',
  startAsset: 94200,
  endAsset: 95700,
  weekReturn: 1.59,
  weekPnl: 1500,
  prevWeekReturn: 1.06,
  daily: [
    { day: '월', date: '03.02', change: 320 },
    { day: '화', date: '03.03', change: -180 },
    { day: '수', date: '03.04', change: 560 },
    { day: '목', date: '03.05', change: -90 },
    { day: '금', date: '03.06', change: 890 },
  ],
  assets: [
    { ticker: 'VOO',  weight: 18.2, weekReturn: 1.8,  weekPnl: 310, price: 538.42 },
    { ticker: 'SCHD', weight: 14.1, weekReturn: 0.9,  weekPnl: 120, price: 27.83 },
    { ticker: 'JEPQ', weight: 12.3, weekReturn: 1.2,  weekPnl: 140, price: 59.21 },
    { ticker: 'BND',  weight: 10.8, weekReturn: 0.3,  weekPnl: 31,  price: 73.54 },
    { ticker: 'SGOV', weight: 9.4,  weekReturn: 0.1,  weekPnl: 9,   price: 100.18 },
    { ticker: 'GLDM', weight: 5.2,  weekReturn: 2.1,  weekPnl: 103, price: 54.67 },
    { ticker: 'BTC',  weight: 2.1,  weekReturn: -3.2, weekPnl: -64, price: 82400 },
    { ticker: 'ETH',  weight: 0.9,  weekReturn: -4.8, weekPnl: -41, price: 2180 },
  ],
  benchmark: { sp500: 1.06, nasdaq: 0.82, myReturn: 1.59 },
  dividends: [
    { date: '03.04', ticker: 'SCHD', amount: 18.42 },
    { date: '03.05', ticker: 'JEPQ', amount: 31.07 },
    { date: '03.05', ticker: 'SGOV', amount: 7.83 },
  ],
};

export const MONTHLY_SAMPLE = {
  period: '2026년 3월',
  month: '2026-03',
  startAsset: 91800,
  endAsset: 95700,
  monthReturn: 4.25,
  monthPnl: 3900,
  prevMonthReturn: 3.72,
  weeklyBreakdown: [
    { week: '1주차', startDate: '03.02', endDate: '03.06', returnPct: 1.59,  pnl: 1500 },
    { week: '2주차', startDate: '03.09', endDate: '03.13', returnPct: 0.88,  pnl: 845 },
    { week: '3주차', startDate: '03.16', endDate: '03.20', returnPct: -0.42, pnl: -408 },
    { week: '4주차', startDate: '03.23', endDate: '03.27', returnPct: 2.11,  pnl: 1963 },
  ],
  assets: [
    { ticker: 'VOO',  monthReturn: 4.8,   monthPnl: 820 },
    { ticker: 'SCHD', monthReturn: 2.1,   monthPnl: 280 },
    { ticker: 'JEPQ', monthReturn: 3.4,   monthPnl: 395 },
    { ticker: 'BND',  monthReturn: 0.8,   monthPnl: 82 },
    { ticker: 'SGOV', monthReturn: 0.4,   monthPnl: 36 },
    { ticker: 'GLDM', monthReturn: 5.9,   monthPnl: 289 },
    { ticker: 'BTC',  monthReturn: -8.2,  monthPnl: -164 },
    { ticker: 'ETH',  monthReturn: -11.4, monthPnl: -97 },
  ],
  benchmark: { sp500: 3.21, nasdaq: 2.87, myReturn: 4.25 },
  totalDividends: 127.43,
  dividendBreakdown: [
    { ticker: 'SCHD', amount: 42.18 },
    { ticker: 'JEPQ', amount: 58.33 },
    { ticker: 'BND',  amount: 9.45 },
    { ticker: 'SGOV', amount: 17.47 },
  ],
};

export const PORTFOLIO_ANALYSIS_SAMPLE = {
  summary:
    '미국 주식, 채권, 금, 암호화폐로 구성된 다자산 포트폴리오로, 채권과 배당형 자산이 전체의 절반 이상을 차지하는 안정성 중심 구조입니다. 지수 추종, 커버드콜, 채권, 금 등 다양한 전략이 혼합되어 있는 형태입니다.',
  scores: [
    {
      label: '분산도',
      score: 82,
      description:
        '미국 주식(지수/배당), 채권(중장/단기), 금, 암호화폐 등 5개 이상의 자산군에 걸쳐 배분되어 있는 구조입니다.',
    },
    {
      label: '안정성',
      score: 78,
      description:
        '채권(BND+SGOV)이 약 29%, 배당형 자산(SCHD+JEPQ)이 약 24%를 차지하여 방어적 성격이 강한 편입니다.',
    },
    {
      label: '수익성',
      score: 58,
      description:
        '성장형 지수(VOO+QQQM) 비중이 약 23%이며, 채권·커버드콜 비중이 높아 강세장에서의 상승 수혜력은 제한적인 특성이 있습니다.',
    },
    {
      label: '배당',
      score: 75,
      description:
        'SCHD, JEPQ, BND, SGOV 등 분배금을 지급하는 자산이 전체의 약 53%를 구성하고 있어 현금흐름 확보에 초점이 맞춰진 구조입니다.',
    },
  ],
  risks: [
    '포트폴리오의 약 75% 이상이 미국 달러 표시 자산으로 구성되어 있어, 원/달러 환율 변동에 대한 노출도가 높은 구조적 특성이 있습니다.',
    'BND의 듀레이션(약 6년)으로 인해 금리 상승 시 채권 가격 하락 압력을 받을 수 있는 구간이 존재하며, 이는 전체 포트폴리오의 약 23%에 해당하는 비중입니다.',
    '한국 주식(133690.KS, 441640.KS)이 약 19%를 차지하고 있어, 한국 시장 및 특정 섹터에 대한 집중 노출이 존재하는 구조입니다.',
  ],
};
