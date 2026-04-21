import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { ACCOUNT_TYPE_COLORS } from '../../types/portfolio';
import { calculateTaxSummary, formatKRW, AccountTaxResult } from '../../utils/taxEngine';
import { getTaxAdvice } from '../../services/api/claude';
import { TaxAdviceResponse } from '../../components/ai/TaxAdviceView';
import TaxAdviceModal from '../../components/ai/TaxAdviceModal';
import { saveTaxAdvice, loadTaxAdvice, formatSavedAt } from '../../services/storage/aiAnalysisStorage';

// ── 계좌 카드 컴포넌트 ──────────────────────────────────────
function AccountCard({ result }: { result: AccountTaxResult }) {
  const { themeColors } = useTheme();
  const acctColor = ACCOUNT_TYPE_COLORS[result.accountType];
  const isProfit = result.unrealizedGain >= 0;

  return (
    <View style={[styles.accountCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, borderLeftColor: acctColor }]}>
      <View style={styles.accountCardHeader}>
        <View style={[styles.accountBadge, { backgroundColor: acctColor + '22' }]}>
          <Text style={[styles.accountBadgeText, { color: acctColor }]}>{result.label}</Text>
        </View>
        <Text style={[styles.accountHoldingCount, { color: themeColors.textSecondary }]}>{result.holdingCount}종목</Text>
      </View>

      <View style={styles.accountCardRow}>
        <View style={styles.accountCardItem}>
          <Text style={[styles.accountCardLabel, { color: themeColors.textSecondary }]}>평가금액</Text>
          <Text style={[styles.accountCardValue, { color: themeColors.text }]}>{formatKRW(result.totalValue)}</Text>
        </View>
        <View style={styles.accountCardItem}>
          <Text style={[styles.accountCardLabel, { color: themeColors.textSecondary }]}>평가손익</Text>
          <Text style={[styles.accountCardValue, { color: isProfit ? themeColors.profit : themeColors.loss }]}>
            {isProfit ? '+' : ''}{formatKRW(result.unrealizedGain)}
          </Text>
        </View>
      </View>

      {result.totalTax > 0 && (
        <View style={styles.taxRow}>
          {result.capitalGainsTax > 0 && (
            <View style={styles.taxItem}>
              <Text style={[styles.taxLabel, { color: themeColors.textSecondary }]}>양도소득세</Text>
              <Text style={styles.taxAmount}>{formatKRW(result.capitalGainsTax)}</Text>
            </View>
          )}
          {result.dividendTax > 0 && (
            <View style={styles.taxItem}>
              <Text style={[styles.taxLabel, { color: themeColors.textSecondary }]}>배당소득세</Text>
              <Text style={styles.taxAmount}>{formatKRW(result.dividendTax)}</Text>
            </View>
          )}
        </View>
      )}

      {result.totalTax === 0 && result.accountType !== 'REGULAR' && (
        <View style={styles.taxFreeRow}>
          <Ionicons name="shield-checkmark" size={14} color="#00C896" />
          <Text style={styles.taxFreeText}>운용 중 세금 없음</Text>
        </View>
      )}

      {result.taxSavedVsRegular > 0 && (
        <View style={styles.savedRow}>
          <Ionicons name="trending-down" size={13} color="#00C896" />
          <Text style={styles.savedText}>
            일반계좌 대비 절세 약 {formatKRW(result.taxSavedVsRegular)}
          </Text>
        </View>
      )}

      <Text style={[styles.accountDesc, { color: themeColors.textSecondary }]}>{result.description}</Text>
    </View>
  );
}

// ── 메인 화면 ─────────────────────────────────────────────────
export default function TaxScreen() {
  const { themeColors } = useTheme();
  const { holdings, exchangeRate } = usePortfolio();

  const [aiAdvice, setAiAdvice] = useState<TaxAdviceResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiSavedAt, setAiSavedAt] = useState<string | null>(null);

  useEffect(() => {
    loadTaxAdvice<TaxAdviceResponse>().then(stored => {
      if (stored) {
        setAiAdvice(stored.data);
        setAiSavedAt(formatSavedAt(stored.savedAt));
      }
    });
  }, []);

  const taxSummary = useMemo(() => {
    if (holdings.length === 0) return null;
    return calculateTaxSummary(holdings, exchangeRate);
  }, [holdings, exchangeRate]);

  const handleOpenAiModal = () => {
    if (aiAdvice) { setAiModalVisible(true); return; }
    handleAiAdvice();
  };

  const handleAiAdvice = async () => {
    if (!taxSummary) return;
    setAiModalVisible(true);
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await getTaxAdvice({
        byAccount: taxSummary.byAccount.map(r => ({
          accountType: r.accountType,
          label: r.label,
          totalValue: r.totalValue,
          unrealizedGain: r.unrealizedGain,
          capitalGainsTax: r.capitalGainsTax,
          dividendTax: r.dividendTax,
          holdingCount: r.holdingCount,
        })),
        holdings: holdings.map(h => ({
          ticker: h.ticker,
          accountType: h.accountType ?? 'REGULAR',
          currency: (h.quote?.currency === 'KRW' ? 'KRW' : 'USD') as 'KRW' | 'USD',
          unrealizedGainKRW: h.profitLoss,
          profitLossPercent: h.profitLossPercent,
          annualDividendKRW: h.dividends.reduce((s, d) => {
            const perShareKRW = d.currency === 'KRW' ? d.amount : d.amount * exchangeRate;
            const times = d.frequency === 'MONTHLY' ? 12 : d.frequency === 'QUARTERLY' ? 4 : d.frequency === 'SEMI_ANNUAL' ? 2 : 1;
            return s + perShareKRW * times * h.quantity;
          }, 0),
        })),
        totalTax: taxSummary.totalTax,
        totalTaxSaved: taxSummary.totalTaxSaved,
        annualDividendTotal: taxSummary.annualDividendTotal,
        comprehensiveTaxRisk: taxSummary.comprehensiveTaxRisk,
        exchangeRate,
      });
      setAiAdvice(result);
      await saveTaxAdvice(result);
      setAiSavedAt(formatSavedAt(new Date().toISOString()));
    } catch {
      setAiModalVisible(false);
      setAiError('AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setAiLoading(false);
    }
  };

  if (holdings.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
        <Ionicons name="calculator-outline" size={56} color={themeColors.textSecondary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>보유 자산을 추가하면{'\n'}절세 분석이 시작됩니다</Text>
      </View>
    );
  }

  if (!taxSummary) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>계산 중...</Text>
      </View>
    );
  }

  const { byAccount, totalCapitalGainsTax, totalDividendTax, totalTax, totalTaxSaved, pensionTaxCredit, annualDividendTotal, comprehensiveTaxRisk, tips } = taxSummary;

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>

      {/* ── 예상 세금 요약 ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>올해 예상 세금</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>양도소득세</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }, totalCapitalGainsTax > 0 && styles.taxRed]}>
              {formatKRW(totalCapitalGainsTax)}
            </Text>
            <Text style={[styles.summaryNote, { color: themeColors.textSecondary }]}>해외주식 차익 22%</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>배당소득세</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }, totalDividendTax > 0 && styles.taxRed]}>
              {formatKRW(totalDividendTax)}
            </Text>
            <Text style={[styles.summaryNote, { color: themeColors.textSecondary }]}>배당금 15.4%</Text>
          </View>
        </View>

        {totalTax > 0 && (
          <View style={[styles.totalTaxRow, { backgroundColor: themeColors.cardBackground }]}>
            <Text style={[styles.totalTaxLabel, { color: themeColors.text }]}>합계 예상 세금</Text>
            <Text style={styles.totalTaxValue}>{formatKRW(totalTax)}</Text>
          </View>
        )}

        {totalTax === 0 && (
          <View style={[styles.totalTaxRow, { backgroundColor: themeColors.cardBackground, borderColor: '#00C89633' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#00C896" />
            <Text style={[styles.totalTaxLabel, { color: '#00C896', marginLeft: 6 }]}>
              현재 예상 세금 없음
            </Text>
          </View>
        )}

        {comprehensiveTaxRisk && (
          <View style={styles.warningRow}>
            <Ionicons name="warning" size={14} color="#FF9500" />
            <Text style={styles.warningText}>
              연간 배당소득 {formatKRW(annualDividendTotal)} → 2,000만원 초과 시 종합과세 적용
            </Text>
          </View>
        )}
      </View>

      {/* ── 절세 효과 ── */}
      {(totalTaxSaved > 0 || pensionTaxCredit.maxCreditHigh > 0) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>절세 효과</Text>

          {totalTaxSaved > 0 && (
            <View style={[styles.benefitRow, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              <View style={[styles.benefitIcon, { backgroundColor: '#00C89622' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#00C896" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: themeColors.text }]}>절세 계좌 운용 절세액</Text>
                <Text style={styles.benefitValue}>약 {formatKRW(totalTaxSaved)} 절약</Text>
                <Text style={[styles.benefitDesc, { color: themeColors.textSecondary }]}>ISA·연금저축·IRP 운용 중 세금 면제</Text>
              </View>
            </View>
          )}

          {pensionTaxCredit.maxCreditHigh > 0 && (
            <View style={[styles.benefitRow, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              <View style={[styles.benefitIcon, { backgroundColor: '#FF950022' }]}>
                <Ionicons name="gift" size={18} color="#FF9500" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: themeColors.text }]}>연금저축·IRP 세액공제</Text>
                <Text style={styles.benefitValue}>
                  최대 {formatKRW(pensionTaxCredit.maxCreditHigh)}/년
                </Text>
                <Text style={[styles.benefitDesc, { color: themeColors.textSecondary }]}>
                  {pensionTaxCredit.creditRateNote}{'\n'}
                  납입한도: 연금저축 400만 + IRP 합산 700만원
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── 계좌별 현황 ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>계좌별 세금 현황</Text>
        {byAccount.map(r => (
          <AccountCard key={r.accountType} result={r} />
        ))}
      </View>

      {/* ── 절세 팁 ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>절세 전략 팁</Text>
        {tips.map((tip, i) => (
          <View key={i} style={[styles.tipRow, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <Ionicons name="bulb-outline" size={16} color={themeColors.primary} style={styles.tipIcon} />
            <Text style={[styles.tipText, { color: themeColors.text }]}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* ── AI 절세 어드바이저 ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>AI 절세 어드바이저</Text>
        <View style={[styles.aiCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
          <View style={styles.aiCardHeader}>
            <View style={styles.aiCardTitleRow}>
              <Ionicons name="sparkles" size={18} color="#A855F7" />
              <Text style={[styles.aiCardTitle, { color: themeColors.text }]}>계좌별 절세 전략 분석</Text>
            </View>
            <Text style={[styles.aiCardDesc, { color: themeColors.textSecondary }]}>
              내 포트폴리오를 AI가 분석하여 절세 효율을 높이는 계좌 운용 전략을 제안합니다.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.aiBtn, { backgroundColor: '#A855F7' }]}
            onPress={handleOpenAiModal}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.aiBtnText}>
              {aiAdvice ? (aiSavedAt ? `${aiSavedAt} 보기` : '분석 결과 보기') : 'AI 분석 시작'}
            </Text>
          </TouchableOpacity>

          {aiError && (
            <View style={styles.aiErrorRow}>
              <Text style={[styles.aiErrorText, { color: themeColors.loss }]}>{aiError}</Text>
              <TouchableOpacity onPress={handleAiAdvice} activeOpacity={0.8}>
                <Text style={[styles.aiRetry, { color: '#A855F7' }]}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}

          <TaxAdviceModal
            visible={aiModalVisible}
            onClose={() => setAiModalVisible(false)}
            data={aiAdvice}
            loading={aiLoading}
            onReanalyze={handleAiAdvice}
            savedAt={aiSavedAt}
          />
        </View>
      </View>

      {/* ── 면책 안내 ── */}
      <View style={[styles.disclaimer, { backgroundColor: themeColors.cardBackground }]}>
        <Text style={[styles.disclaimerText, { color: themeColors.textSecondary }]}>
          * 본 계산은 참고용이며 실제 세금과 다를 수 있습니다.{'\n'}
          정확한 세금 신고는 세무사 또는 국세청 홈택스를 이용하세요.
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ── Section ──
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  // ── Tax Summary ──
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  taxRed: {
    color: '#FF6B6B',
  },
  summaryNote: {
    fontSize: 11,
    opacity: 0.7,
  },
  totalTaxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
    marginBottom: 8,
  },
  totalTaxLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalTaxValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#FF9500',
    lineHeight: 18,
  },

  // ── Benefits ──
  benefitRow: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 3,
  },
  benefitValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00C896',
    marginBottom: 3,
  },
  benefitDesc: {
    fontSize: 11,
    lineHeight: 16,
  },

  // ── Account Cards ──
  accountCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  accountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  accountBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  accountHoldingCount: {
    fontSize: 12,
  },
  accountCardRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  accountCardItem: {
    flex: 1,
  },
  accountCardLabel: {
    fontSize: 11,
    marginBottom: 3,
  },
  accountCardValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  taxRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  taxItem: {
    flex: 1,
  },
  taxLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  taxAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  taxFreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  taxFreeText: {
    fontSize: 12,
    color: '#00C896',
    fontWeight: '600',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  savedText: {
    fontSize: 12,
    color: '#00C896',
  },
  accountDesc: {
    fontSize: 11,
    opacity: 0.8,
    lineHeight: 16,
  },

  // ── Tips ──
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Disclaimer ──
  disclaimer: {
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 18,
  },

  // ── AI 절세 어드바이저 ──
  aiCard: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  aiCardHeader: { gap: 8 },
  aiCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiCardTitle: { fontSize: 15, fontWeight: '700' },
  aiCardDesc: { fontSize: 13, lineHeight: 19 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  aiBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  aiLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  aiLoadingText: { fontSize: 13 },
  aiErrorRow: { gap: 8, alignItems: 'center' },
  aiErrorText: { fontSize: 13, textAlign: 'center' },
  aiRetry: { fontSize: 13, textDecorationLine: 'underline' },
  aiResultWrap: { gap: 12 },
  aiResult: { fontSize: 14, lineHeight: 22 },
  aiRefreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  aiRefreshText: { fontSize: 13, fontWeight: '600' },
});
