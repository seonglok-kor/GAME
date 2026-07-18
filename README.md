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

## 네이티브 개발 빌드 (Google 로그인 / AdMob 테스트용)

```bash
eas build --profile development --platform android
# 또는
eas build --profile development --platform ios
```

빌드된 dev client를 기기에 설치하고 `npm run start`로 연결하면 실제 Google 로그인과 AdMob 리워드 광고(현재는 Google 공식 테스트 광고 ID 사용 중)를 테스트할 수 있습니다.

## 웹 빌드 & Firebase Hosting

```bash
npx expo export --platform web
npx firebase-tools deploy --only hosting
```

배포 대상은 `firebase.json`의 `hosting.target`(`legendslsl`)이며, 실제 접속 주소는 `https://legendslsl.web.app` 입니다.

## AdMob

`app.json`의 `react-native-google-mobile-ads` 플러그인 설정과 `App.tsx`의 `REWARDED_AD_UNIT_ID`는 현재 Google의 **공식 테스트 광고 ID**로 되어 있습니다. 실제 수익화를 시작하려면:

1. https://admob.google.com 에서 계정을 만들고 이 앱을 등록해 실제 App ID / 광고 단위 ID를 발급받습니다.
2. `app.json`의 `androidAppId`/`iosAppId`와 `App.tsx`의 `REWARDED_AD_UNIT_ID`를 실제 값으로 교체합니다.
3. AdMob 결제 프로필(계좌/세금 정보)을 등록해야 수익이 지급됩니다.
