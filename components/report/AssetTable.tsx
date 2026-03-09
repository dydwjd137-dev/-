import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const MINT = '#00FFA3'; const PINK = '#FF006B';
const TEXT = '#E8E0FF'; const TEXT_SEC = '#8B7FBF';
const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const CARD = { backgroundColor: 'rgba(107,79,255,0.06)', borderWidth: 1, borderColor: 'rgba(107,79,255,0.18)', borderRadius: 14, padding: 14 } as const;

export interface ReportAsset {
  ticker: string;
  weight: number;
  weekReturn: number;
  weekPnl: number;
  monthReturn: number;
  monthPnl: number;
  price: number;
}

interface Props {
  assets: ReportAsset[];
  mode: 'weekly' | 'monthly';
}

function retColor(v: number) { return v >= 0 ? MINT : PINK; }
function fmtRet(v: number) { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }
function fmtPnl(v: number) { return `${v >= 0 ? '+$' : '-$'}${Math.abs(v).toFixed(0)}`; }

export default function AssetTable({ assets, mode }: Props) {
  const ret = (a: ReportAsset) => mode === 'weekly' ? a.weekReturn : a.monthReturn;
  const pnl = (a: ReportAsset) => mode === 'weekly' ? a.weekPnl   : a.monthPnl;

  return (
    <View style={CARD}>
      {/* Header */}
      <View style={[s.row, s.header]}>
        <Text style={[s.col1, s.hdr, { color: TEXT_SEC }]}>종목</Text>
        {mode === 'weekly' && <Text style={[s.col2, s.hdr, { color: TEXT_SEC }]}>비중</Text>}
        <Text style={[s.col3, s.hdr, { color: TEXT_SEC }]}>수익률</Text>
        <Text style={[s.col4, s.hdr, { color: TEXT_SEC }]}>손익</Text>
        {mode === 'weekly' && <Text style={[s.col5, s.hdr, { color: TEXT_SEC }]}>현재가</Text>}
      </View>
      <View style={s.divider} />

      {assets.map((a, i) => {
        const r  = ret(a);
        const p  = pnl(a);
        const rc = retColor(r);
        return (
          <View key={a.ticker} style={[s.row, i % 2 === 1 && s.rowAlt]}>
            <Text style={[s.col1, { color: TEXT, fontWeight: '700' }]}>{a.ticker}</Text>
            {mode === 'weekly' && (
              <Text style={[s.col2, { color: TEXT_SEC, fontFamily: MONO }]}>{a.weight.toFixed(1)}%</Text>
            )}
            <Text style={[s.col3, { color: rc, fontFamily: MONO }]}>{fmtRet(r)}</Text>
            <Text style={[s.col4, { color: rc, fontFamily: MONO }]}>{fmtPnl(p)}</Text>
            {mode === 'weekly' && (
              <Text style={[s.col5, { color: TEXT_SEC, fontFamily: MONO }]} numberOfLines={1}>
                {a.price > 0 ? `$${a.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  rowAlt: { backgroundColor: 'rgba(107,79,255,0.04)' },
  header: { paddingBottom: 6 },
  hdr:    { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(107,79,255,0.18)', marginBottom: 4 },
  col1: { flex: 1.6, fontSize: 13 },
  col2: { flex: 1,   fontSize: 12, textAlign: 'right' },
  col3: { flex: 1.3, fontSize: 12, textAlign: 'right' },
  col4: { flex: 1.3, fontSize: 12, textAlign: 'right' },
  col5: { flex: 1.5, fontSize: 12, textAlign: 'right' },
});
