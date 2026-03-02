import { BrokerageId } from '../types/portfolio';

/**
 * 증권사 로고 이미지 맵 (정적 require)
 * assets/broker-logos/ 폴더의 .webp 파일을 교체하면 자동 반영됩니다.
 */
export const BROKERAGE_LOGOS: Record<BrokerageId, any> = {
  HANWHA: require('../assets/broker-logos/hanwha.webp'),
  DB:     require('../assets/broker-logos/db.webp'),
  KB:     require('../assets/broker-logos/kb.webp'),
  NAMU:   require('../assets/broker-logos/namu.webp'),
  KAKAO:  require('../assets/broker-logos/kakao.webp'),
  MIRAE:  require('../assets/broker-logos/mirae.webp'),
  SAMSUNG: require('../assets/broker-logos/samsung.webp'),
  SHINHAN: require('../assets/broker-logos/shinhan.webp'),
  NAVER:  require('../assets/broker-logos/naver.webp'),
  KIWOOM: require('../assets/broker-logos/kiwoom.webp'),
  TOSS:   require('../assets/broker-logos/toss.webp'),
  HANA:   require('../assets/broker-logos/hana.webp'),
  KIS:    require('../assets/broker-logos/kis.webp'),
  MERITZ: require('../assets/broker-logos/meritz.webp'),
};
