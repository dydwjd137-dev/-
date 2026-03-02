import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { config } from '../config';
import { useTheme } from '../contexts/DisplayPreferencesContext';

// ── 타입 ────────────────────────────────────────────────
interface TickerItem {
  key: string;
  name: string;
  changePercent: number;
  price: number;
  change: number;
}

interface QuoteData {
  percent: number;
  price: number;
  change: number;
}

// ── 심볼 목록 ─────────────────────────────────────────
const MARKET_CONFIG = [
  // ETF (지수 대체)
  { symbol: 'SPY',         name: 'SPY'       },
  { symbol: 'QQQ',         name: 'QQQ'       },
  // 미국 시총 Top 12
  { symbol: 'NVDA',        name: 'NVDA'      },
  { symbol: 'AAPL',        name: 'AAPL'      },
  { symbol: 'GOOGL',       name: 'GOOGL'     },
  { symbol: 'MSFT',        name: 'MSFT'      },
  { symbol: 'AMZN',        name: 'AMZN'      },
  { symbol: 'META',        name: 'META'      },
  { symbol: 'AVGO',        name: 'AVGO'      },
  { symbol: 'TSLA',        name: 'TSLA'      },
  { symbol: 'BRK.B',       name: 'BRK-B'     },
  { symbol: 'WMT',         name: 'WMT'       },
  { symbol: 'LLY',         name: 'LLY'       },
  { symbol: 'JPM',         name: 'JPM'       },
  // 코스피 시총 Top 5
  { symbol: '005930:KRX',  name: '삼성전자'   },
  { symbol: '000660:KRX',  name: 'SK하이닉스' },
  { symbol: '373220:KRX',  name: 'LG에너지'   },
  { symbol: '005380:KRX',  name: '현대차'     },
  { symbol: '000270:KRX',  name: '기아'       },
  // 원자재
  { symbol: 'XAU/USD',     name: '금'         },
  { symbol: 'XAG/USD',     name: '은'         },
  // 코인
  { symbol: 'BTC/USD',     name: 'BTC'       },
  { symbol: 'ETH/USD',     name: 'ETH'       },
];

// ── 로고 URL ─────────────────────────────────────────
// KRX·코인처럼 FMP 패턴과 다른 심볼만 명시; US 주식/ETF는 자동 생성
const SPECIAL_LOGO_URLS: Record<string, string> = {
  '005930:KRX': 'https://financialmodelingprep.com/image-stock/005930.KS.png',
  '000660:KRX': 'https://financialmodelingprep.com/image-stock/000660.KS.png',
  '373220:KRX': 'https://financialmodelingprep.com/image-stock/373220.KS.png',
  '005380:KRX': 'https://financialmodelingprep.com/image-stock/005380.KS.png',
  '000270:KRX': 'https://financialmodelingprep.com/image-stock/000270.KS.png',
  'BTC/USD': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  'ETH/USD': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
};

// US 주식·ETF는 FMP 패턴으로 자동 생성
function getLogoUrl(symbol: string): string {
  return SPECIAL_LOGO_URLS[symbol]
    ?? `https://financialmodelingprep.com/image-stock/${symbol}.png`;
}


// ── SVG 금괴 아이콘 ───────────────────────────────────
function IngotIcon({ isGold }: { isGold: boolean }) {
  const top     = isGold ? '#FFE566' : '#E8E8E8';
  const front   = isGold ? '#D4A000' : '#A8A8A8';
  const side    = isGold ? '#B8860B' : '#808080';
  const engrave = isGold ? '#C49200' : '#969696';

  return (
    <Svg width={22} height={15} viewBox="0 0 22 15">
      {/* 앞면 */}
      <Path d="M1 7 L21 7 L21 14 L1 14 Z" fill={front} />
      {/* 윗면 (사다리꼴) */}
      <Path d="M3 1 L19 1 L21 7 L1 7 Z" fill={top} />
      {/* 왼쪽 측면 */}
      <Path d="M1 7 L3 1 L3 1 L1 7 Z" fill={side} />
      {/* 앞면 하단 그림자 */}
      <Rect x={1} y={11} width={20} height={3} rx={1} fill={side} opacity={0.5} />
      {/* 앞면 광택 라인 */}
      <Rect x={4} y={9} width={14} height={1} rx={0.5} fill={engrave} opacity={0.6} />
    </Svg>
  );
}

// ── API 호출 ──────────────────────────────────────────
const BASE_URL = `${config.backendUrl}/api`;

/**
 * raw API 응답 객체에서 QuoteData 파싱.
 * percent_change 대신 close/previous_close 로 직접 계산해 정확도 향상.
 */
function parseQuote(q: any): QuoteData | null {
  if (!q || q.code || q.status === 'error') return null;
  const close     = parseFloat(q.close     ?? q.price ?? '0');
  const prevClose = parseFloat(q.previous_close ?? '0');
  if (isNaN(close) || close === 0) return null;

  const percent = prevClose > 0
    ? ((close - prevClose) / prevClose) * 100
    : parseFloat(q.percent_change ?? '0');
  const change = prevClose > 0
    ? close - prevClose
    : parseFloat(q.change ?? '0');

  return { percent, price: close, change };
}

/** 복수 심볼 배치 호출 (nested 응답) */
async function fetchBatchQuotes(
  symbols: string[]
): Promise<Record<string, QuoteData | null>> {
  const out: Record<string, QuoteData | null> = {};
  if (!symbols.length) return out;
  try {
    const params = new URLSearchParams({
      symbol: symbols.join(','),
    });
    const res  = await fetch(`${BASE_URL}/quote?${params}`);
    const data = await res.json();

    for (const sym of symbols) {
      // 배치 응답은 심볼 키로 중첩됨; KRX 심볼은 콜론 앞 부분으로 fallback
      const q = data[sym] ?? data[sym.split(':')[0]];
      out[sym] = parseQuote(q);
    }
  } catch (e) {
    console.warn('[MarketTicker] batch fetch error:', e);
    symbols.forEach(s => { out[s] = null; });
  }
  return out;
}

/**
 * 전체 티커 데이터 로드.
 * - ETF + 미국/한국 주식: 배치 호출
 * - 원자재/코인: 배치 호출
 */
async function fetchAllTicker(): Promise<TickerItem[]> {
  const stockSyms = MARKET_CONFIG.slice(0, 19).map(c => c.symbol); // SPY, QQQ + 12 US + 5 KRX
  const forexSyms = MARKET_CONFIG.slice(19).map(c => c.symbol);    // XAU, XAG, BTC, ETH

  const [stockMap, forexMap] = await Promise.all([
    fetchBatchQuotes(stockSyms),
    fetchBatchQuotes(forexSyms),
  ]);

  const combined: Record<string, QuoteData | null> = {
    ...stockMap,
    ...forexMap,
  };

  return MARKET_CONFIG
    .filter(c => combined[c.symbol] != null)
    .map(c => ({
      key:           c.symbol,
      name:          c.name,
      changePercent: combined[c.symbol]!.percent,
      price:         combined[c.symbol]!.price,
      change:        combined[c.symbol]!.change,
    }));
}

// ── 가격 / 절대변동 포맷 ───────────────────────────────
function fmtPrice(price: number, symbol: string): string {
  if (!price || isNaN(price)) return '--';

  if (symbol.endsWith(':KRX')) {
    return '₩' + Math.round(price).toLocaleString('ko-KR');
  }
  if (symbol === 'BTC/USD') {
    return '$' + Math.round(price).toLocaleString('en-US');
  }
  if (symbol === 'ETH/USD') {
    return '$' + Math.round(price).toLocaleString('en-US');
  }
  // 미국 주식 / 원자재: 소수점 2자리
  return '$' + price.toFixed(2);
}

function fmtChange(absChange: number, symbol: string): string {
  if (isNaN(absChange)) return '0';

  if (symbol.endsWith(':KRX')) {
    return '₩' + Math.round(absChange).toLocaleString('ko-KR');
  }
  if (symbol === 'BTC/USD') {
    return '$' + Math.round(absChange).toLocaleString('en-US');
  }
  if (symbol === 'ETH/USD') {
    return '$' + absChange.toFixed(0);
  }
  // 미국 주식 / 원자재
  return absChange >= 10
    ? '$' + absChange.toFixed(1)
    : '$' + absChange.toFixed(2);
}

// ── 로고 컴포넌트 ────────────────────────────────────
function TickerLogo({ symbol, name }: { symbol: string; name: string }) {
  const { themeColors } = useTheme();
  const [imgError, setImgError] = useState(false);

  if (symbol === 'XAU/USD') return <IngotIcon isGold={true} />;
  if (symbol === 'XAG/USD') return <IngotIcon isGold={false} />;

  if (!imgError) {
    return (
      <Image
        source={{ uri: getLogoUrl(symbol) }}
        style={styles.logo}
        onError={() => setImgError(true)}
        resizeMode="contain"
      />
    );
  }

  const bg = themeColors.primary;
  return (
    <View style={[styles.logoFallback, { backgroundColor: bg + '33', borderColor: bg + '66' }]}>
      <Text style={[styles.logoFallbackText, { color: bg }]}>
        {name.slice(0, 1)}
      </Text>
    </View>
  );
}

// ── 개별 아이템 ──────────────────────────────────────
function TickerItemView({ item }: { item: TickerItem }) {
  const { themeColors } = useTheme();
  const up    = item.changePercent >= 0;
  const color = up ? themeColors.profit : themeColors.loss;
  const arrow = up ? '▲' : '▼';
  const pct   = Math.abs(item.changePercent).toFixed(2);

  return (
    <View style={styles.item}>
      <TickerLogo symbol={item.key} name={item.name} />
      <Text style={[styles.itemName, { color: themeColors.textSecondary }]}>{item.name}</Text>
      <Text style={[styles.itemPrice, { color: themeColors.text }]}>{fmtPrice(item.price, item.key)}</Text>
      <Text style={[styles.itemChange, { color }]}>
        {arrow}{fmtChange(Math.abs(item.change), item.key)} {pct}%
      </Text>
      <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
    </View>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────
export default function MarketTicker() {
  const { themeColors } = useTheme();
  const [items, setItems]             = useState<TickerItem[]>([]);
  const [singleWidth, setSingleWidth] = useState(0);
  const scrollX      = useRef(new Animated.Value(0)).current;
  const animRef      = useRef<Animated.CompositeAnimation | null>(null);
  const widthRef     = useRef(0);
  const wsRef        = useRef<WebSocket | null>(null);
  const prevCloseRef = useRef<Record<string, number>>({});   // 전일종가 (모든 심볼)

  // ── Animated.loop — 리셋 프레임 없이 seamless 루프 ──
  const startLoop = useCallback((width: number) => {
    if (width <= 0) return;
    widthRef.current = width;
    animRef.current?.stop();
    scrollX.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(scrollX, {
        toValue:  -width,
        duration: width * 30,
        easing:   Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animRef.current.start();
  }, [scrollX]);

  const stopLoop = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  // ── 전 심볼 실시간 WebSocket ──
  const connectWS = useCallback(() => {
    // 이미 열려 있으면 재연결하지 않음
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

    const wsUrl = config.backendUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const allSymbols = MARKET_CONFIG.map(c => c.symbol).join(',');
      ws.send(JSON.stringify({
        action: 'subscribe',
        params: { symbols: allSymbols },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event !== 'price') return;

        const sym: string  = msg.symbol;
        const newPrice     = parseFloat(msg.price);
        if (isNaN(newPrice)) return;

        const prev    = prevCloseRef.current[sym] ?? 0;
        const change  = prev > 0 ? newPrice - prev : 0;
        const pct     = prev > 0 ? (change / prev) * 100 : 0;

        setItems(prev =>
          prev.map(item =>
            item.key === sym
              ? { ...item, price: newPrice, change, changePercent: pct }
              : item
          )
        );
      } catch {}
    };

    ws.onerror = (e) => console.warn('[MarketTicker WS] error:', e);
    ws.onclose = () => console.log('[MarketTicker WS] closed');
  }, []);

  // ── 데이터 로드 ──
  const load = useCallback(async () => {
    try {
      const data = await fetchAllTicker();
      if (data.length > 0) {
        setItems(data);
        // 전일종가 저장 (price - change = previous_close) — 전 심볼
        data.forEach(item => {
          prevCloseRef.current[item.key] = item.price - item.change;
        });
        connectWS();
      }
    } catch (e) {
      console.warn('[MarketTicker] load error:', e);
    }
  }, [connectWS]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [load]);

  // ── 너비 확정 후 애니메이션 시작 ──
  // items.length만 의존: 가격 업데이트(setItems)로 인한 불필요한 재시작 방지
  useEffect(() => {
    if (singleWidth <= 0 || items.length === 0) return;
    stopLoop();
    const t = setTimeout(() => startLoop(singleWidth), 16);
    return () => { clearTimeout(t); stopLoop(); };
  }, [singleWidth, items.length, startLoop, stopLoop]);

  if (items.length === 0) return <View style={[styles.container, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]} />;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
      {/* 단일 세트 너비 측정용 숨김 뷰 */}
      <View
        style={styles.measurer}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          // 8px 이상 변할 때만 업데이트 (가격 텍스트 폭 변화로 인한 불필요한 재시작 방지)
          setSingleWidth(prev => Math.abs(w - prev) > 8 ? w : prev);
        }}
        pointerEvents="none"
      >
        {items.map((item, i) => <TickerItemView key={`m${i}`} item={item} />)}
      </View>

      {/* 실제 스크롤 뷰 (이중 세트 → 끊김 없는 루프) */}
      <Animated.View style={[styles.track, { transform: [{ translateX: scrollX }] }]}>
        {[...items, ...items].map((item, i) => (
          <TickerItemView key={i} item={item} />
        ))}
      </Animated.View>
    </View>
  );
}

// ── 스타일 ───────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    height: 36,
    borderBottomWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  measurer: {
    flexDirection: 'row',
    position: 'absolute',
    opacity: 0,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 5,
  },
  logo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  logoFallback: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackText: {
    fontSize: 9,
    fontWeight: '800',
  },
  itemName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  itemPrice: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemChange: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 10,
    marginLeft: 4,
  },
});
