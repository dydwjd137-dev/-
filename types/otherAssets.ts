export type OtherAssetSubtype =
  | 'cash-usd'
  | 'cash-krw'
  | 'jeonse'
  | 'wolse-deposit'
  | 'apartment'
  | 'house';

export interface OtherAsset {
  id: string;
  subtype: OtherAssetSubtype;
  name: string;       // 사용자 지정 라벨 (e.g. "강남 아파트", "달러 예치금")
  amount: number;     // 금액 (currency 기준)
  currency: 'KRW' | 'USD';
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  name: string;       // 대출명
  amount: number;     // KRW
  createdAt: string;
  updatedAt: string;
}

export const OTHER_ASSET_LABELS: Record<OtherAssetSubtype, string> = {
  'cash-usd':      '달러',
  'cash-krw':      '원화',
  'jeonse':        '전세보증금',
  'wolse-deposit': '월세보증금',
  'apartment':     '아파트',
  'house':         '주택',
};

export const OTHER_ASSET_ICONS: Record<OtherAssetSubtype, string> = {
  'cash-usd':      '💵',
  'cash-krw':      '💴',
  'jeonse':        '🔑',
  'wolse-deposit': '🔑',
  'apartment':     '🏢',
  'house':         '🏠',
};
