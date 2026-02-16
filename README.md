# KongDad Portfolio

포트폴리오 관리 앱 - React Native + Expo

## 주요 기능

- 📊 실시간 주식/ETF/코인 포트폴리오 관리
- 📈 히트맵 시각화 (성과 기반 색상 코딩)
- 💰 배당 캘린더
- 🔄 자동 시세 업데이트 (Yahoo Finance API)
- 💾 로컬 데이터 저장 (AsyncStorage)

## 설치 방법

### 1. 저장소 클론
```bash
git clone https://github.com/YOUR_USERNAME/KongDadPortfolio.git
cd KongDadPortfolio
```

### 2. 의존성 설치
```bash
npm install --legacy-peer-deps
```

### 3. API 키 설정
1. [RapidAPI Yahoo Finance15](https://rapidapi.com/sparior/api/yahoo-finance15)에서 API 키를 발급받습니다
2. `config.example.ts` 파일을 복사하여 `config.ts` 파일을 생성합니다:
   ```bash
   cp config.example.ts config.ts
   ```
3. `config.ts` 파일에 발급받은 API 키를 입력합니다:
   ```typescript
   export const config = {
     rapidApi: {
       key: 'YOUR_RAPIDAPI_KEY_HERE',
       host: 'yahoo-finance15.p.rapidapi.com',
     },
   };
   ```

### 4. 앱 실행
```bash
npm start
```

그 다음:
- **웹**: `w` 키 입력
- **Android**: Expo Go 앱에서 QR 스캔
- **iOS**: Expo Go 앱에서 QR 스캔

## 기술 스택

- **Framework**: React Native + Expo
- **언어**: TypeScript
- **상태관리**: React Context API
- **API**: Yahoo Finance (via RapidAPI)
- **저장소**: AsyncStorage
- **라우팅**: Expo Router

## 프로젝트 구조

```
KongDadPortfolio/
├── app/              # 화면 (Expo Router)
│   └── (tabs)/      # 탭 네비게이션
├── components/       # 재사용 컴포넌트
├── contexts/         # React Context
├── services/         # API & 저장소 서비스
├── types/           # TypeScript 타입 정의
├── utils/           # 유틸리티 함수
└── constants/       # 상수 (색상, 테마 등)
```

## 보안 주의사항

⚠️ **절대 `config.ts` 파일을 Git에 커밋하지 마세요!**

이 파일에는 API 키가 포함되어 있으며, `.gitignore`에 추가되어 있습니다.

## 라이센스

MIT
