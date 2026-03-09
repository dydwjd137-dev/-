import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import {
  loadSnapshots,
  PortfolioSnapshot,
} from '../../services/storage/snapshotStorage';
import {
  overwriteSnapshot,
  bulkApplySnapshots,
  backfillHistoricalPrices,
  deleteSnapshot,
  validateDateRange,
  validateSingleDate,
  todayStr,
  localDateStr,
  BulkApplyResult,
  BackfillProgress,
} from '../../engine/snapshotEditorEngine';
import { ACCENT_MAP } from '../../constants/themes';

// ── Format helpers ────────────────────────────────────────────

function fmtKRW(v: number) {
  return `₩${Math.round(v).toLocaleString()}`;
}

function fmtPct(cost: number, value: number) {
  if (cost <= 0) return '—';
  const pct = ((value - cost) / cost) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

/** 오늘 기준 N일 전 날짜를 YYYY-MM-DD로 반환 */
function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateStr(d);
}

// ── Status banner (inline, no Alert) ─────────────────────────

type StatusState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error';   message: string };

function StatusBanner({ status, accentHex }: { status: StatusState; accentHex: string }) {
  if (status.kind === 'idle') return null;

  if (status.kind === 'loading') {
    return (
      <View style={[bannerStyles.box, { backgroundColor: accentHex + '18' }]}>
        <ActivityIndicator size="small" color={accentHex} />
        <Text style={[bannerStyles.text, { color: accentHex }]}>{status.message}</Text>
      </View>
    );
  }
  if (status.kind === 'success') {
    return (
      <View style={[bannerStyles.box, { backgroundColor: '#00C89618' }]}>
        <Ionicons name="checkmark-circle" size={15} color="#00C896" />
        <Text style={[bannerStyles.text, { color: '#00C896' }]}>{status.message}</Text>
      </View>
    );
  }
  // error
  return (
    <View style={[bannerStyles.box, { backgroundColor: '#FF453A18' }]}>
      <Ionicons name="alert-circle" size={15} color="#FF453A" />
      <Text style={[bannerStyles.text, { color: '#FF453A' }]}>{status.message}</Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  text: { fontSize: 13, fontWeight: '600', flex: 1 },
});

// ── Backfill progress bar ─────────────────────────────────────

function BackfillProgressBar({
  progress,
  accentHex,
  textColor,
  secondaryColor,
}: {
  progress: BackfillProgress | null;
  accentHex: string;
  textColor: string;
  secondaryColor: string;
}) {
  if (!progress) return null;

  const pct = progress.total > 0 ? progress.done / progress.total : 0;
  const phaseLabel =
    progress.phase === 'fx'     ? 'USD/KRW 환율 불러오는 중...' :
    progress.phase === 'ticker' ? `${progress.ticker} 종가 불러오는 중... (${progress.done + 1}/${progress.total})` :
    progress.phase === 'saving' ? '스냅샷 저장 중...' :
                                  '완료';

  return (
    <View style={pbStyles.container}>
      <View style={pbStyles.labelRow}>
        <Text style={[pbStyles.label, { color: textColor }]} numberOfLines={1}>
          {phaseLabel}
        </Text>
        <Text style={[pbStyles.count, { color: secondaryColor }]}>
          {progress.done}/{progress.total}
        </Text>
      </View>
      <View style={[pbStyles.track, { backgroundColor: accentHex + '22' }]}>
        <View
          style={[
            pbStyles.fill,
            { width: `${Math.round(pct * 100)}%`, backgroundColor: accentHex },
          ]}
        />
      </View>
    </View>
  );
}

const pbStyles = StyleSheet.create({
  container: { marginTop: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  count: { fontSize: 12 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});

// ── Date text input ───────────────────────────────────────────

/** 숫자만 추출 후 YYYY-MM-DD 포맷으로 자동 변환 (8자리 입력 지원) */
function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function DateInput({
  label,
  value,
  onChange,
  textColor,
  borderColor,
  placeholderColor,
  cardBg,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textColor: string;
  borderColor: string;
  placeholderColor: string;
  cardBg: string;
}) {
  return (
    <View style={inputStyles.container}>
      <Text style={[inputStyles.label, { color: placeholderColor }]}>{label}</Text>
      <TextInput
        style={[inputStyles.input, { color: textColor, borderColor, backgroundColor: cardBg }]}
        value={value}
        onChangeText={(t) => onChange(formatDateInput(t))}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={placeholderColor}
        keyboardType="number-pad"
        maxLength={10}
      />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
});

// ── Action button ─────────────────────────────────────────────

function ActionButton({
  label,
  onPress,
  loading,
  color,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
  color: string;
}) {
  return (
    <TouchableOpacity
      style={[btnStyles.btn, { backgroundColor: color, opacity: loading ? 0.7 : 1 }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator size="small" color="#fff" />
        : <Text style={btnStyles.label}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ── Section card / title ──────────────────────────────────────

function SectionCard({ children, cardBg }: { children: React.ReactNode; cardBg: string }) {
  return <View style={[cardStyles.card, { backgroundColor: cardBg }]}>{children}</View>;
}
const cardStyles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, marginBottom: 14 },
});

function SectionTitle({
  title,
  icon,
  accentHex,
  textColor,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentHex: string;
  textColor: string;
}) {
  return (
    <View style={titleStyles.row}>
      <Ionicons name={icon} size={15} color={accentHex} />
      <Text style={[titleStyles.text, { color: textColor }]}>{title}</Text>
    </View>
  );
}
const titleStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  text: { fontSize: 13, fontWeight: '700' },
});

// ── Snapshot list row ─────────────────────────────────────────

function SnapshotRow({
  snap,
  onDelete,
  onOverwrite,
  accentHex,
  textColor,
  secondaryColor,
  borderColor,
  cardBg,
}: {
  snap: PortfolioSnapshot;
  onDelete: () => void;
  onOverwrite: () => void;
  accentHex: string;
  textColor: string;
  secondaryColor: string;
  borderColor: string;
  cardBg: string;
}) {
  const profit = snap.totalValue - snap.totalCost;
  const positive = profit >= 0;
  const profitColor = positive ? '#00C896' : '#FF453A';

  return (
    <View style={[rowStyles.row, { borderColor, backgroundColor: cardBg }]}>
      <View style={rowStyles.left}>
        <Text style={[rowStyles.date, { color: textColor }]}>{snap.date}</Text>
        <Text style={[rowStyles.pct, { color: profitColor }]}>{fmtPct(snap.totalCost, snap.totalValue)}</Text>
      </View>
      <View style={rowStyles.mid}>
        <Text style={[rowStyles.value, { color: textColor }]}>{fmtKRW(snap.totalValue)}</Text>
        <Text style={[rowStyles.cost, { color: secondaryColor }]}>원금 {fmtKRW(snap.totalCost)}</Text>
      </View>
      <View style={rowStyles.actions}>
        <TouchableOpacity onPress={onOverwrite} style={rowStyles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="refresh" size={17} color={accentHex} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={rowStyles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={17} color="#FF453A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 8,
  },
  left: { width: 96 },
  date: { fontSize: 12, fontWeight: '700' },
  pct: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  mid: { flex: 1 },
  value: { fontSize: 13, fontWeight: '700' },
  cost: { fontSize: 11, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
});

// ── Main Modal ────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

const IDLE: StatusState = { kind: 'idle' };

export function SnapshotManagerModal({ visible, onClose }: Props) {
  const { themeColors, prefs } = useTheme();
  const { holdings, exchangeRate, bumpSnapshotVersion } = usePortfolio();
  const accentHex = ACCENT_MAP[prefs.accentColor];

  const tc  = themeColors.text;
  const sc  = themeColors.textSecondary;
  const bc  = themeColors.border;
  const cbg = themeColors.cardBackground;
  const bg  = themeColors.background;

  // ── Snapshot list ────────────────────────────────────────────
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const reload = useCallback(async () => {
    setListLoading(true);
    try {
      const all = await loadSnapshots();
      setSnapshots([...all].reverse());
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      reload();
      setSingleDate(todayStr());
      setSingleStatus(IDLE);
      setBulkStatus(IDLE);
      setHStatus(IDLE);
    }
  }, [visible, reload]);

  // ── Single date ──────────────────────────────────────────────
  const [singleDate, setSingleDate]   = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleStatus, setSingleStatus]   = useState<StatusState>(IDLE);

  const handleSingleApply = useCallback(async () => {
    setSingleStatus(IDLE);
    const v = validateSingleDate(singleDate);
    if (!v.valid) {
      setSingleStatus({ kind: 'error', message: v.error! });
      return;
    }
    if (holdings.length === 0) {
      setSingleStatus({ kind: 'error', message: '포트폴리오에 종목이 없습니다.' });
      return;
    }
    setSingleLoading(true);
    setSingleStatus({ kind: 'loading', message: '저장 중...' });
    try {
      await overwriteSnapshot(singleDate, holdings);
      setSingleStatus({ kind: 'success', message: `${singleDate} 스냅샷 저장 완료` });
      bumpSnapshotVersion();
      await reload();
    } catch (e: any) {
      setSingleStatus({ kind: 'error', message: e?.message ?? '저장에 실패했습니다.' });
    } finally {
      setSingleLoading(false);
    }
  }, [singleDate, holdings, reload]);

  // ── Bulk apply ───────────────────────────────────────────────
  const [bulkStart, setBulkStart]   = useState('');
  const [bulkEnd, setBulkEnd]       = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus]   = useState<StatusState>(IDLE);

  const handleBulkApply = useCallback(async () => {
    setBulkStatus(IDLE);
    const v = validateDateRange(bulkStart, bulkEnd);
    if (!v.valid) {
      setBulkStatus({ kind: 'error', message: v.error! });
      return;
    }
    if (holdings.length === 0) {
      setBulkStatus({ kind: 'error', message: '포트폴리오에 종목이 없습니다.' });
      return;
    }
    setBulkLoading(true);
    setBulkStatus({ kind: 'loading', message: '저장 중...' });
    try {
      const r = await bulkApplySnapshots(bulkStart, bulkEnd, holdings);
      if (r.error) {
        setBulkStatus({ kind: 'error', message: r.error });
      } else {
        setBulkStatus({ kind: 'success', message: `저장 ${r.saved} · 건너뜀 ${r.skipped} · 실패 ${r.failed}` });
        bumpSnapshotVersion();
        await reload();
      }
    } catch (e: any) {
      setBulkStatus({ kind: 'error', message: e?.message ?? '저장에 실패했습니다.' });
    } finally {
      setBulkLoading(false);
    }
  }, [bulkStart, bulkEnd, holdings, reload]);

  // ── Historical backfill ──────────────────────────────────────
  const [hStart, setHStart]   = useState('');
  const [hEnd, setHEnd]       = useState('');
  const [hLoading, setHLoading] = useState(false);
  const [hStatus, setHStatus]   = useState<StatusState>(IDLE);
  const [hProgress, setHProgress] = useState<BackfillProgress | null>(null);

  /** N일 전 ~ 오늘 자동 설정 (days-1을 사용해 inclusive N일) */
  const setHPreset = useCallback((days: number) => {
    setHStart(daysAgoStr(days - 1));
    setHEnd(todayStr());
    setHStatus(IDLE);
    setHProgress(null);
  }, []);

  const handleBackfill = useCallback(async () => {
    setHStatus(IDLE);
    setHProgress(null);
    const v = validateDateRange(hStart, hEnd);
    if (!v.valid) {
      setHStatus({ kind: 'error', message: v.error! });
      return;
    }
    if (holdings.length === 0) {
      setHStatus({ kind: 'error', message: '포트폴리오에 종목이 없습니다.' });
      return;
    }
    setHLoading(true);
    try {
      const r = await backfillHistoricalPrices(
        hStart,
        hEnd,
        holdings,
        exchangeRate,
        (p) => setHProgress({ ...p }),   // 진행 상황 실시간 반영
      );
      setHProgress(null);
      if (r.error) {
        setHStatus({ kind: 'error', message: r.error });
      } else {
        // 종목별 데이터 수신 요약
        const noDataMsg = r.tickersNoData && r.tickersNoData.length > 0
          ? `\n데이터 없음: ${r.tickersNoData.join(', ')}`
          : '';
        const okMsg = r.tickersOk !== undefined
          ? `${r.tickersOk}/${(r.tickersOk + (r.tickersNoData?.length ?? 0))}종목 수신` : '';

        if (r.saved === 0) {
          setHStatus({ kind: 'error', message: `저장 0일 · 건너뜀 ${r.skipped}일 · ${okMsg}${noDataMsg}` });
        } else {
          setHStatus({ kind: 'success', message: `저장 ${r.saved}일 · 건너뜀 ${r.skipped}일 · ${okMsg}${noDataMsg}` });
          bumpSnapshotVersion();
          await reload();
        }
      }
    } catch (e: any) {
      setHProgress(null);
      setHStatus({ kind: 'error', message: e?.message ?? '백필에 실패했습니다.' });
    } finally {
      setHLoading(false);
    }
  }, [hStart, hEnd, holdings, exchangeRate, reload]);

  // ── Row handlers ─────────────────────────────────────────────

  const handleDeleteRow = useCallback((date: string) => {
    Alert.alert(
      '스냅샷 삭제',
      `${date} 스냅샷을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteSnapshot(date);
            bumpSnapshotVersion();
            await reload();
          },
        },
      ],
    );
  }, [reload]);

  const handleOverwriteRow = useCallback(async (date: string) => {
    if (holdings.length === 0) return;
    try {
      await overwriteSnapshot(date, holdings);
      bumpSnapshotVersion();
      await reload();
    } catch {}
  }, [holdings, bumpSnapshotVersion, reload]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: bg }]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: bc }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={tc} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: tc }]}>스냅샷 히스토리</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >

          {/* ── 단일 날짜 저장 ── */}
          <SectionCard cardBg={cbg}>
            <SectionTitle title="단일 날짜 저장" icon="calendar-outline" accentHex={accentHex} textColor={tc} />
            <DateInput
              label="날짜"
              value={singleDate}
              onChange={setSingleDate}
              textColor={tc}
              borderColor={bc}
              placeholderColor={sc}
              cardBg={bg}
            />
            <StatusBanner status={singleStatus} accentHex={accentHex} />
            <ActionButton
              label="현재 가격으로 저장"
              onPress={handleSingleApply}
              loading={singleLoading}
              color={accentHex}
            />
          </SectionCard>

          {/* ── 기간 일괄 적용 ── */}
          <SectionCard cardBg={cbg}>
            <SectionTitle title="기간 일괄 적용 (현재 가격)" icon="layers-outline" accentHex={accentHex} textColor={tc} />
            <Text style={[styles.hint, { color: sc }]}>
              선택 기간 전체에 현재 가격 스냅샷을 저장합니다. 최대 90일.
            </Text>
            <View style={styles.dateRow}>
              <DateInput label="시작일" value={bulkStart} onChange={setBulkStart} textColor={tc} borderColor={bc} placeholderColor={sc} cardBg={bg} />
              <View style={{ width: 10 }} />
              <DateInput label="종료일" value={bulkEnd}  onChange={setBulkEnd}  textColor={tc} borderColor={bc} placeholderColor={sc} cardBg={bg} />
            </View>
            <StatusBanner status={bulkStatus} accentHex={accentHex} />
            <ActionButton
              label="기간 일괄 저장"
              onPress={handleBulkApply}
              loading={bulkLoading}
              color={accentHex}
            />
          </SectionCard>

          {/* ── 과거 데이터 백필 ── */}
          <SectionCard cardBg={cbg}>
            <SectionTitle title="과거 데이터 백필" icon="time-outline" accentHex={accentHex} textColor={tc} />
            <Text style={[styles.hint, { color: sc }]}>
              전체 보유 종목의 과거 종가를 순차적으로 불러와 스냅샷을 생성합니다. 주말·휴일은 직전 거래일 가격으로 채워집니다.
            </Text>

            {/* 날짜 빠른 선택 */}
            <View style={styles.presetRow}>
              {[30, 60, 90].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.presetBtn, { borderColor: bc, backgroundColor: cbg }]}
                  onPress={() => setHPreset(d)}
                  activeOpacity={0.7}
                  disabled={hLoading}
                >
                  <Text style={[styles.presetText, { color: accentHex }]}>최근 {d}일</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dateRow}>
              <DateInput label="시작일" value={hStart} onChange={v => { setHStart(v); setHStatus(IDLE); }} textColor={tc} borderColor={bc} placeholderColor={sc} cardBg={bg} />
              <View style={{ width: 10 }} />
              <DateInput label="종료일" value={hEnd}   onChange={v => { setHEnd(v);   setHStatus(IDLE); }} textColor={tc} borderColor={bc} placeholderColor={sc} cardBg={bg} />
            </View>

            {/* 진행 상황 */}
            {hProgress && (
              <BackfillProgressBar
                progress={hProgress}
                accentHex={accentHex}
                textColor={tc}
                secondaryColor={sc}
              />
            )}

            <StatusBanner status={hStatus} accentHex={accentHex} />
            <ActionButton
              label={hLoading ? '백필 중...' : '백필 시작'}
              onPress={handleBackfill}
              loading={hLoading}
              color="#FF9500"
            />
          </SectionCard>

          {/* ── 스냅샷 목록 ── */}
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, { color: tc }]}>저장된 스냅샷 ({snapshots.length})</Text>
            <TouchableOpacity onPress={reload} style={{ padding: 4 }} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={18} color={accentHex} />
            </TouchableOpacity>
          </View>

          {listLoading ? (
            <ActivityIndicator size="small" color={accentHex} style={{ marginVertical: 20 }} />
          ) : snapshots.length === 0 ? (
            <Text style={[styles.emptyText, { color: sc }]}>저장된 스냅샷이 없습니다.</Text>
          ) : (
            snapshots.map(snap => (
              <SnapshotRow
                key={snap.date}
                snap={snap}
                onDelete={() => handleDeleteRow(snap.date)}
                onOverwrite={() => handleOverwriteRow(snap.date)}
                accentHex={accentHex}
                textColor={tc}
                secondaryColor={sc}
                borderColor={bc}
                cardBg={cbg}
              />
            ))
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: { fontSize: 12, fontWeight: '700' },

  dateRow: { flexDirection: 'row' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  listTitle: { fontSize: 14, fontWeight: '700' },
  emptyText: { textAlign: 'center', fontSize: 13, marginVertical: 20 },
});
