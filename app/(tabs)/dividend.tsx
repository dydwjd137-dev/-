import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import Colors from '../../constants/Colors';
import { usePortfolio } from '../../contexts/PortfolioContext';
import {
  generateDividendCalendar,
  groupDividendsByMonth,
} from '../../utils/dividendCalendar';
import { formatKRW, formatDate } from '../../utils/portfolioCalculations';

export default function DividendScreen() {
  const { holdings, summary, isLoading } = usePortfolio();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>배당 정보 불러오는 중...</Text>
      </View>
    );
  }

  const dividendEvents = generateDividendCalendar(holdings);
  const groupedByMonth = groupDividendsByMonth(dividendEvents);
  const monthKeys = Object.keys(groupedByMonth).sort();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>배당 캘린더</Text>
        <Text style={styles.subtitle}>예상 배당 일정</Text>
      </View>

      {/* 배당 요약 */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>월 배당 예상</Text>
            <Text style={[styles.summaryValue, { color: Colors.dividend }]}>
              {summary ? formatKRW(summary.monthlyDividendEstimate) : '₩0'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>연 배당 예상</Text>
            <Text style={[styles.summaryValue, { color: Colors.dividend }]}>
              {summary ? formatKRW(summary.annualDividendEstimate) : '₩0'}
            </Text>
          </View>
        </View>
      </View>

      {/* 월별 배당 일정 */}
      {dividendEvents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>배당 정보가 없습니다</Text>
          <Text style={styles.emptySubtext}>
            배당을 지급하는 종목을 추가해보세요
          </Text>
        </View>
      ) : (
        monthKeys.map((monthKey) => {
          const [year, month] = monthKey.split('-');
          const events = groupedByMonth[monthKey];
          const monthTotal = events.reduce((sum, e) => sum + e.amount, 0);

          return (
            <View key={monthKey} style={styles.monthSection}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>
                  {year}년 {month}월
                </Text>
                <Text style={[styles.monthTotal, { color: Colors.dividend }]}>
                  {formatKRW(monthTotal)}
                </Text>
              </View>

              {events.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventRow}>
                    <View style={styles.eventLeft}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              event.status === 'upcoming'
                                ? Colors.dividend
                                : Colors.textSecondary,
                          },
                        ]}
                      />
                      <View>
                        <Text style={styles.eventTicker}>{event.ticker}</Text>
                        <Text style={styles.eventDate}>
                          {formatDate(event.date)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.eventAmount, { color: Colors.dividend }]}>
                      {formatKRW(event.amount)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontSize: 14,
  },
  header: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 24,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    marginHorizontal: 24,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    opacity: 0.6,
  },
  monthSection: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  monthTotal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  eventCard: {
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventTicker: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  eventAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
