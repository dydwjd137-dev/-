import {
  EnrichedHolding,
  DividendCalendarEvent,
  DividendInfo,
} from '../types/portfolio';

// 배당 캘린더 생성
export function generateDividendCalendar(
  holdings: EnrichedHolding[]
): DividendCalendarEvent[] {
  const events: DividendCalendarEvent[] = [];

  holdings.forEach((holding) => {
    if (!holding.dividends || holding.dividends.length === 0) return;

    holding.dividends.forEach((div) => {
      const totalAmount = div.amount * holding.quantity;

      events.push({
        id: `${holding.ticker}-${div.paymentDate.toISOString()}`,
        ticker: holding.ticker,
        stockName: holding.ticker, // 실제로는 회사명 조회 가능
        date: div.paymentDate,
        amount: totalAmount,
        currency: div.currency,
        status: div.paymentDate > new Date() ? 'upcoming' : 'paid',
      });
    });
  });

  // 날짜순 정렬
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  return events;
}

// 다가오는 배당 조회 (N일 이내)
export function getUpcomingDividends(
  events: DividendCalendarEvent[],
  daysAhead: number = 30
): DividendCalendarEvent[] {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return events.filter(
    (e) => e.status === 'upcoming' && e.date >= now && e.date <= futureDate
  );
}

// 월별 배당 그룹화
export function groupDividendsByMonth(
  events: DividendCalendarEvent[]
): Record<string, DividendCalendarEvent[]> {
  const grouped: Record<string, DividendCalendarEvent[]> = {};

  events.forEach((event) => {
    const monthKey = `${event.date.getFullYear()}-${String(
      event.date.getMonth() + 1
    ).padStart(2, '0')}`;
    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(event);
  });

  return grouped;
}

// 월별 배당 총액 계산
export function calculateMonthlyDividendEstimate(
  holdings: EnrichedHolding[]
): number {
  let annualDividend = 0;

  holdings.forEach((holding) => {
    if (!holding.dividends || holding.dividends.length === 0) return;

    holding.dividends.forEach((d) => {
      const paymentsPerYear = getPaymentsPerYear(d.frequency);
      annualDividend += d.amount * holding.quantity * paymentsPerYear;
    });
  });

  return annualDividend / 12;
}

// 배당 빈도에 따른 연간 지급 횟수
function getPaymentsPerYear(frequency: DividendInfo['frequency']): number {
  switch (frequency) {
    case 'ANNUAL':
      return 1;
    case 'SEMI_ANNUAL':
      return 2;
    case 'QUARTERLY':
      return 4;
    case 'MONTHLY':
      return 12;
  }
}

// 이번 주 배당 조회
export function getThisWeekDividends(
  events: DividendCalendarEvent[]
): DividendCalendarEvent[] {
  return getUpcomingDividends(events, 7);
}

// 다음 주 배당 조회
export function getNextWeekDividends(
  events: DividendCalendarEvent[]
): DividendCalendarEvent[] {
  const now = new Date();
  const nextWeekStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return events.filter(
    (e) =>
      e.status === 'upcoming' &&
      e.date >= nextWeekStart &&
      e.date <= nextWeekEnd
  );
}
