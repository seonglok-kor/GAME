# GAME

말랑말랑 진화 연구소 — Expo 앱. Firebase(Auth + Firestore), EAS, GitHub에 연결되어 있습니다.

## Firebase setup (quickstart)

1. `firebaseConfig.example.ts`를 `firebaseConfig.ts`로 복사하고, Firebase Console → 프로젝트 설정 → SDK 설정에서 값을 채웁니다.
2. Authentication → Sign-in method에서 **Google** 제공자를 사용 설정합니다. 사용 설정하면 자동 생성되는 "Web client ID"를 `firebaseConfig.ts`의 `googleWebClientId`에 넣습니다.
3. 설치 후 실행:

```powershell
npm install
npm run start
```

로그인 방식:
- 이 앱은 **Google 로그인**을 사용합니다 (전화번호 인증은 SMS 비용이 들어서 제외했습니다).
- 웹에서는 Firebase의 `signInWithPopup`으로 별도 네이티브 빌드 없이 바로 동작합니다.
- iOS/Android 네이티브에서는 `@react-native-google-signin/google-signin`을 쓰는데, **Expo Go에서는 동작하지 않고 EAS 개발 빌드(dev client)가 필요합니다.**

Firestore:
- 로그인한 사용자의 진행 상황(레벨/티켓 등)은 `firebase.ts` + `App.tsx`를 통해 `users/{uid}` 문서에 자동 저장/로드됩니다. 기기를 바꿔도 같은 Google 계정으로 로그인하면 이어집니다.

## 네이티브 빌드 (Google 로그인 / AdMob 테스트용)

```bash
# 개발 서버(npm run start)에 붙는 dev client — 코드 수정하며 바로 테스트할 때
eas build --profile development --platform android

# 그 자체로 완결된 standalone APK — 용량이 훨씬 작고 컴퓨터 연결 불필요
eas build --profile preview --platform android
```

설치한 빌드를 열면 실제 Google 로그인과 AdMob 리워드 광고를 테스트할 수 있습니다. 개발 빌드(`__DEV__`가 true)에서는 항상 Google 공식 테스트 광고가 나가고, 프로덕션 빌드에서만 실제 광고 단위(`App.tsx`의 `REAL_REWARDED_AD_UNIT_ID`)가 사용됩니다.

`react-native-google-mobile-ads`는 `16.0.3`으로 고정돼 있습니다 — 그 이후 버전(16.1.0+)이 번들하는 Google Mobile Ads SDK가 요구하는 Kotlin 버전이 Expo SDK 57 기본 Kotlin 컴파일러보다 높아서 빌드가 깨집니다.

iOS 기기에 실제로 설치하려면 **Apple 개발자 프로그램($99/년)** 가입이 필요합니다 (애플이 서명 안 된 앱의 실기기 설치를 막아두어서, 우회할 방법이 없습니다). 계정이 없다면 웹 버전(`https://legendslsl.web.app`)으로 테스트하세요.

## 웹 빌드 & Firebase Hosting

```bash
npx expo export --platform web
npx firebase-tools deploy --only hosting
```

배포 대상은 `firebase.json`의 `hosting.target`(`legendslsl`)이며, 실제 접속 주소는 `https://legendslsl.web.app` 입니다.

## AdMob

Android는 실제 AdMob 앱/광고 단위가 연결되어 있습니다 (`app.json`의 `androidAppId`, `App.tsx`의 `REAL_REWARDED_AD_UNIT_ID`). 개발 빌드는 항상 테스트 광고를 쓰고, **프로덕션 빌드(`eas build --profile production`)에서만 실제 광고**가 나갑니다.

iOS는 아직 AdMob에 앱을 등록하지 않아서 `app.json`의 `iosAppId`가 Google 테스트 ID로 남아 있습니다. iOS에서도 수익화하려면 AdMob 콘솔에서 iOS 앱을 추가로 등록하고 `iosAppId`/iOS용 광고 단위 ID를 반영하세요.

수익을 실제로 지급받으려면 AdMob에서 결제 프로필(계좌/세금 정보)을 등록해야 합니다.
