import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import initFirebase from './firebase';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';
import {
  AD_REWARD_TICKETS,
  DAILY_TICKETS,
  LEVEL_NAMES,
  MAX_LEVEL,
  OUTCOME_MESSAGES,
  outcomeKind,
  reinforceMallangi,
} from './lib/mallangi';

// Native Google Sign-In needs a custom dev build (unavailable in Expo Go); web uses Firebase's own popup flow instead.
let GoogleSignin: any = null;
if (Platform.OS !== 'web') {
  try {
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch (e) {
    GoogleSignin = null;
  }
}

// AdMob is a native module too (unavailable on web / Expo Go); we fall back to the simulated countdown there.
let MobileAds: any = null;
let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdEventType: any = null;
let TestIds: any = null;
if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    MobileAds = ads.default;
    RewardedAd = ads.RewardedAd;
    RewardedAdEventType = ads.RewardedAdEventType;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;
  } catch (e) {
    MobileAds = null;
  }
}
// Using Google's public test unit until a real AdMob account/app is registered.
const REWARDED_AD_UNIT_ID = TestIds ? TestIds.REWARDED : '';

const GOOGLE_WEB_CLIENT_ID = (() => {
  try {
    return require('./firebaseConfig').default.googleWebClientId as string | undefined;
  } catch (e) {
    return undefined;
  }
})();

const AD_DURATION_SECONDS = 30;
const STORAGE_KEY = '@mallangi_game_state';
const INTRO_STORAGE_KEY = '@mallangi_intro_seen';
const TICKETS_RESET_KEY = '@mallangi_tickets_reset_date';

type OutcomeTone = 'good' | 'neutral' | 'bad';

type SavedState = {
  level: number;
  tickets: number;
  message: string;
  tone: OutcomeTone;
  lastPlayedAt: string;
};

const TONE_BY_KIND: Record<ReturnType<typeof outcomeKind>, OutcomeTone> = {
  great_success: 'good',
  success: 'good',
  no_change: 'neutral',
  weaken: 'bad',
  great_fail: 'bad',
};

const TONE_COLORS: Record<OutcomeTone, string> = {
  good: '#2E9E5B',
  neutral: '#7A7A7A',
  bad: '#D8483A',
};

function formatTimestamp(value: string) {
  if (!value) return '아직 기록 없음';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '방금 전';

  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getRankLabel(level: number, tickets: number) {
  const progressRatio = level / MAX_LEVEL;
  const roughRank = Math.max(1, Math.min(99, Math.round(100 - progressRatio * 70 - (tickets < 3 ? 8 : 0))));
  return `상위 ${roughRank}% 내외`;
}

export default function App() {
  const [level, setLevel] = useState(0);
  const [tickets, setTickets] = useState(DAILY_TICKETS);
  const [message, setMessage] = useState('말랑이를 조물조물해서 최종 형태를 완성하세요!');
  const [tone, setTone] = useState<OutcomeTone>('neutral');
  const [isBusy, setIsBusy] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(AD_DURATION_SECONDS);
  const [isPhonePreview, setIsPhonePreview] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [celebratePulse, setCelebratePulse] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [nickname, setNickname] = useState('말랑이 주인');
  const [userId, setUserId] = useState<string | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState('');
  const [lastPlayedAt, setLastPlayedAt] = useState('');
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [authMessage, setAuthMessage] = useState('Google 계정으로 로그인해 주세요.');
  const [isRewardedAdLoaded, setIsRewardedAdLoaded] = useState(false);
  const rewardedAdRef = useRef<any>(null);
  const adTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [autoScalePreview, setAutoScalePreview] = useState(true);

  const isComplete = level === MAX_LEVEL;
  const DESIRED_PHONE_WIDTH = 360;
  const DESIRED_PHONE_HEIGHT = 780;
  const previewWidth = Math.min(windowWidth - 32, DESIRED_PHONE_WIDTH);
  const previewHeight = Math.min(windowHeight * 0.82, DESIRED_PHONE_HEIGHT);
  const previewScale = Math.min(1, (windowWidth - 32) / DESIRED_PHONE_WIDTH);

  useEffect(() => {
    return () => {
      if (adTimer.current) clearInterval(adTimer.current);
    };
  }, []);

  // Preload a rewarded ad on native (Android/iOS dev builds); web has no AdMob SDK and uses the fallback countdown instead.
  useEffect(() => {
    if (Platform.OS === 'web' || !MobileAds || !RewardedAd) return;

    MobileAds()
      .initialize()
      .catch((error: any) => console.warn('AdMob init failed', error));

    const rewarded = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID);
    rewardedAdRef.current = rewarded;

    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsRewardedAdLoaded(true);
    });
    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      setTickets((t) => t + AD_REWARD_TICKETS);
      setMessage(`✨ 조물조물 횟수 ${AD_REWARD_TICKETS}회 충전 완료!`);
      setTone('good');
    });
    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setIsWatchingAd(false);
      setIsRewardedAdLoaded(false);
      rewarded.load();
    });

    rewarded.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn && !hasSeenIntro) {
      setShowIntro(true);
    } else {
      setShowIntro(false);
    }
  }, [isLoggedIn, hasSeenIntro]);

  useEffect(() => {
    if (!isAnimating) {
      pulseAnim.setValue(1);
      shakeAnim.setValue(0);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.96, duration: 120, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      ])
    );

    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
      ])
    );

    pulse.start();
    shake.start();

    return () => {
      pulse.stop();
      shake.stop();
    };
  }, [isAnimating, pulseAnim, shakeAnim]);

  useEffect(() => {
    let cancelled = false;

    async function loadIntroState() {
      try {
        const raw = await AsyncStorage.getItem(INTRO_STORAGE_KEY);
        if (!raw || cancelled) return;

        const seen = JSON.parse(raw) as boolean;
        if (typeof seen === 'boolean') {
          setHasSeenIntro(seen);
        }
      } catch (error) {
        console.warn('Failed to load intro state', error);
      }
    }

    loadIntroState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || cancelled) return;

        const parsed = JSON.parse(raw) as Partial<SavedState>;
        if (typeof parsed.level === 'number') setLevel(parsed.level);
        if (typeof parsed.tickets === 'number') setTickets(parsed.tickets);
        if (typeof parsed.message === 'string') setMessage(parsed.message);
        if (parsed.tone === 'good' || parsed.tone === 'neutral' || parsed.tone === 'bad') {
          setTone(parsed.tone);
        }
        if (typeof parsed.lastPlayedAt === 'string') setLastPlayedAt(parsed.lastPlayedAt);
      } catch (error) {
        console.warn('Failed to load game state', error);
      } finally {
        if (!cancelled) {
          setHasLoaded(true);
        }
      }
    }

    loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;

    const payload: SavedState = {
      level,
      tickets,
      message,
      tone,
      lastPlayedAt,
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((error) => {
      console.warn('Failed to save game state', error);
    });
  }, [hasLoaded, level, tickets, message, tone]);

  // Daily tickets reset at local 05:00:00 — refill to DAILY_TICKETS once per reset window.
  useEffect(() => {
    if (!hasLoaded) return;

    let cancelled = false;
    const RESET_HOUR = 5; // 05:00 local

    async function checkResetAtFive() {
      try {
        const raw = await AsyncStorage.getItem(TICKETS_RESET_KEY);
        const now = new Date();
        const todayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate(), RESET_HOUR, 0, 0, 0);
        // Determine the most recent reset moment (today at 05:00 if now >= that, otherwise yesterday at 05:00)
        const lastEligibleReset = now >= todayReset ? todayReset : new Date(todayReset.getTime() - 24 * 60 * 60 * 1000);

        const lastEligibleIso = lastEligibleReset.toISOString();

        if (!raw || new Date(raw) < lastEligibleReset) {
          if (!cancelled) {
            setTickets(DAILY_TICKETS);
            await AsyncStorage.setItem(TICKETS_RESET_KEY, lastEligibleIso);
          }
        }
      } catch (err) {
        console.warn('Failed to check/reset tickets', err);
      }
    }

    checkResetAtFive();
    return () => {
      cancelled = true;
    };
  }, [hasLoaded]);

  function applyLoggedInUser(user: User, silent = false) {
    setIsLoggedIn(true);
    setUserId(user.uid);
    setNickname(user.displayName || '말랑이 주인');
    setLastLoginAt(new Date().toISOString());
    setAuthMessage(silent ? '자동 로그인 상태로 복구되었습니다.' : 'Google 로그인이 완료되었습니다. 게임을 시작해 보세요.');
  }

  useEffect(() => {
    const res = initFirebase();
    if (!res.configured) {
      setFirebaseReady(false);
      setIsAutoLoggingIn(false);
      return;
    }

    setFirebaseReady(true);
    if (Platform.OS !== 'web' && GoogleSignin) {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    }

    const unsubscribe = onAuthStateChanged(res.auth, (user: User | null) => {
      if (user) {
        applyLoggedInUser(user, true);
      } else {
        setIsLoggedIn(false);
        setUserId(null);
      }
      setIsAutoLoggingIn(false);
    });

    return unsubscribe;
  }, []);

  // Pull saved progress from Firestore once we know who's logged in, so it carries over across devices.
  useEffect(() => {
    if (!userId || !firebaseReady) return;

    let cancelled = false;

    async function loadCloudState() {
      try {
        const { db } = initFirebase() as any;
        const snap = await getDoc(doc(db, 'users', userId as string));
        if (cancelled || !snap.exists()) return;

        const parsed = snap.data() as Partial<SavedState>;
        if (typeof parsed.level === 'number') setLevel(parsed.level);
        if (typeof parsed.tickets === 'number') setTickets(parsed.tickets);
        if (typeof parsed.message === 'string') setMessage(parsed.message);
        if (parsed.tone === 'good' || parsed.tone === 'neutral' || parsed.tone === 'bad') {
          setTone(parsed.tone);
        }
        if (typeof parsed.lastPlayedAt === 'string') setLastPlayedAt(parsed.lastPlayedAt);
      } catch (error) {
        console.warn('Failed to load cloud game state', error);
      }
    }

    loadCloudState();
    return () => {
      cancelled = true;
    };
  }, [userId, firebaseReady]);

  // Mirror local progress up to Firestore so switching devices keeps the same 말랑이.
  useEffect(() => {
    if (!hasLoaded || !userId || !firebaseReady) return;

    const payload: SavedState = { level, tickets, message, tone, lastPlayedAt };

    (async () => {
      try {
        const { db } = initFirebase() as any;
        await setDoc(doc(db, 'users', userId), payload, { merge: true });
      } catch (error) {
        console.warn('Failed to save cloud game state', error);
      }
    })();
  }, [hasLoaded, userId, firebaseReady, level, tickets, message, tone, lastPlayedAt]);

  async function handleGoogleLogin() {
    setAuthMessage('Google 로그인 진행 중...');
    try {
      const { auth } = initFirebase() as any;

      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        applyLoggedInUser(result.user);
        return;
      }

      if (!GoogleSignin) {
        setAuthMessage('Google 로그인은 개발 빌드(EAS dev client)에서만 사용할 수 있습니다.');
        return;
      }

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo?.data?.idToken ?? userInfo?.idToken;
      if (!idToken) throw new Error('Google idToken을 받지 못했습니다.');

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      applyLoggedInUser(result.user);
    } catch (error) {
      console.warn('Google login failed', error);
      setAuthMessage('Google 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  async function handleLogout() {
    try {
      const { auth } = initFirebase() as any;
      if (Platform.OS !== 'web' && GoogleSignin) {
        await GoogleSignin.signOut().catch(() => {});
      }
      await firebaseSignOut(auth);
    } catch (error) {
      console.warn('Logout failed', error);
    }
    setIsLoggedIn(false);
    setUserId(null);
    setLastLoginAt('');
    setAuthMessage('로그아웃되었습니다. 다시 로그인해 주세요.');
  }

  function handleStartTutorial() {
    const nextSeen = true;
    setHasSeenIntro(nextSeen);
    setShowIntro(false);
    AsyncStorage.setItem(INTRO_STORAGE_KEY, JSON.stringify(nextSeen)).catch((error) => {
      console.warn('Failed to save intro state', error);
    });
  }

  function handleReinforce() {
    if (isBusy || isComplete || tickets <= 0) return;

    setIsBusy(true);
    setIsAnimating(true);
    setTickets((t) => t - 1);
    setLastPlayedAt(new Date().toISOString());
    setMessage('조물... 쪼물... 꾸욱...');
    setTone('neutral');

    setTimeout(() => {
      const { newLevel, selectedChange, actualChange } = reinforceMallangi(level);
      const kind = outcomeKind(selectedChange);

      let text = OUTCOME_MESSAGES[kind];
      if (selectedChange !== actualChange) {
        text += '\n🛡️ 최저 단계 보호로 0단계에서 멈췄습니다.';
      }
      if (newLevel === MAX_LEVEL) {
        text += '\n🎉 최종 말랑이 완성! 전설의 모아이 석상 돌을 탄생시켰습니다!';
      }

      setLevel(newLevel);
      setMessage(text);
      setTone(TONE_BY_KIND[kind]);
      setIsBusy(false);
      setIsAnimating(false);
      setCelebratePulse(true);
      setTimeout(() => setCelebratePulse(false), 800);
    }, 500);
  }

  function startAd() {
    if (isWatchingAd) return;

    if (Platform.OS !== 'web' && rewardedAdRef.current && isRewardedAdLoaded) {
      setIsWatchingAd(true);
      rewardedAdRef.current.show();
      return;
    }

    // Fallback for web / Expo Go / ad not preloaded yet: simulated countdown, same reward at the end.
    setIsWatchingAd(true);
    setAdSecondsLeft(AD_DURATION_SECONDS);

    adTimer.current = setInterval(() => {
      setAdSecondsLeft((s) => {
        if (s <= 1) {
          if (adTimer.current) clearInterval(adTimer.current);
          setIsWatchingAd(false);
          setTickets((t) => t + AD_REWARD_TICKETS);
          setMessage(`✨ 조물조물 횟수 ${AD_REWARD_TICKETS}회 충전 완료!`);
          setTone('good');
          return AD_DURATION_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
  }

  const renderLoginScreen = () => (
    <View style={styles.container}>
      {isAutoLoggingIn ? (
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>로그인 정보를 확인하는 중입니다</Text>
          <Text style={styles.authHint}>잠시만 기다려 주세요.</Text>
        </View>
      ) : (
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>🧸 말랑말랑 진화 연구소 🧪</Text>
              <Text style={styles.subtitle}>로그인해서 말랑이의 진화를 기록해 보세요.</Text>
            </View>
          </View>

          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Google 계정으로 시작하기</Text>
            <Text style={styles.authHint}>{authMessage}</Text>
            <Pressable style={styles.mainButton} onPress={handleGoogleLogin}>
              <Text style={styles.mainButtonText}>Google로 로그인</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );

  const renderGameContent = () => (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>🧸 말랑말랑 진화 연구소 🧪</Text>
          <Text style={styles.subtitle}>{nickname}님, 말랑이를 조물조물해서 최종 형태를 완성해 보세요.</Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>로그아웃</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeaderRow}>
          <Text style={styles.summaryTitle}>오늘의 진화 기록</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.summaryBadge}>로그인 유지 중</Text>
            <Text style={styles.highlightBadge}>{isComplete ? '보상 가능 구간' : `상위권 예상 ${getRankLabel(level, tickets)}`}</Text>
          </View>
        </View>
        <Text style={styles.summaryText}>마지막 접속: {formatTimestamp(lastLoginAt)}</Text>
        <Text style={styles.summaryText}>마지막 진화: {formatTimestamp(lastPlayedAt)}</Text>
      </View>

      <Animated.View
        style={[
          styles.card,
          celebratePulse && styles.cardCelebrating,
          isAnimating && {
            transform: [
              { scale: pulseAnim },
              {
                rotate: shakeAnim.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-3deg', '3deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.Text style={[styles.emoji, isAnimating && { transform: [{ scale: pulseAnim }] }]}>
          {LEVEL_NAMES[level].split(' ')[0]}
        </Animated.Text>
        <Text style={styles.levelName}>{LEVEL_NAMES[level].split(' ').slice(1).join(' ')}</Text>
        <Text style={styles.levelBadge}>Lv. {level} / {MAX_LEVEL}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(level / MAX_LEVEL) * 100}%` }]} />
        </View>
      </Animated.View>

      <View style={[styles.messageBox, { borderColor: TONE_COLORS[tone] }]}>
        <Text style={[styles.messageText, { color: TONE_COLORS[tone] }]}>{message}</Text>
        {celebratePulse && <Text style={styles.messageSpark}>✨</Text>}

        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>남은 횟수</Text>
          <Text style={styles.metaValue}>{tickets}회</Text>
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>진화 단계</Text>
          <Text style={styles.metaValue}>{level}/{MAX_LEVEL}</Text>
        </View>
      </View>

      {showIntro && (
        <View style={styles.introOverlay}>
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>말랑이와 첫 만남</Text>
            <Text style={styles.introSubtitle}>한 번의 조물조물로 진화의 흐름이 바뀝니다.</Text>
            <View style={styles.introStepList}>
              <View style={styles.introStepItem}>
                <Text style={styles.introStepNumber}>1</Text>
                <Text style={styles.introStepText}>진화 버튼을 누르면 말랑이가 반응해요.</Text>
              </View>
              <View style={styles.introStepItem}>
                <Text style={styles.introStepNumber}>2</Text>
                <Text style={styles.introStepText}>성공하면 단계가 올라가고, 실패하면 보호로 멈출 수 있어요.</Text>
              </View>
              <View style={styles.introStepItem}>
                <Text style={styles.introStepNumber}>3</Text>
                <Text style={styles.introStepText}>광고를 보고 추가 횟수를 얻으면 계속 진화할 수 있어요.</Text>
              </View>
            </View>
            <Pressable style={styles.introButton} onPress={handleStartTutorial}>
              <Text style={styles.introButtonText}>진화 시작하기</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isComplete ? (
        <View style={styles.doneBanner}>
          <Text style={styles.doneText}>🏆 최종 진화 완료!</Text>
        </View>
      ) : tickets > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.mainButton, pressed && styles.buttonPressed]}
          onPress={handleReinforce}
          disabled={isBusy}
        >
          <Text style={styles.mainButtonText}>{isBusy ? '조물조물 중...' : '조물조물하기'}</Text>
        </Pressable>
      ) : isWatchingAd ? (
        <View style={styles.adButton}>
          <Text style={styles.adButtonText}>🎬 광고 재생 중... {adSecondsLeft}초</Text>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.adButton, pressed && styles.buttonPressed]}
          onPress={startAd}
        >
          <Text style={styles.adButtonText}>📺 광고 보고 {AD_REWARD_TICKETS}회 더 받기</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <Pressable
          style={({ pressed }) => [styles.previewToggle, pressed && styles.buttonPressed]}
          onPress={() => setIsPhonePreview((value) => !value)}
        >
          <Text style={styles.previewToggleText}>
            {isPhonePreview ? '전체 화면으로 보기' : '모바일 화면처럼 보기'}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.autoScaleToggle, pressed && styles.buttonPressed]}
          onPress={() => setAutoScalePreview((v) => !v)}
        >
          <Text style={styles.autoScaleText}>{autoScalePreview ? '자동 축소: 켬' : '자동 축소: 끔'}</Text>
        </Pressable>

        {isPhonePreview ? (
          <View style={{ width: previewWidth, height: previewHeight, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={autoScalePreview ? { transform: [{ scale: previewScale }] } : undefined}>
              <View style={[styles.phoneShell, { width: '100%', height: '100%' }]}> 
                <View style={styles.phoneBezel}>
                  <View style={styles.notch} />
                  <View style={styles.phoneScreen}>
                    <SafeAreaView style={styles.phoneScreenSafeArea}>
                      {isLoggedIn ? renderGameContent() : renderLoginScreen()}
                    </SafeAreaView>
                  </View>
                  <View style={styles.homeIndicator} />
                </View>
              </View>
            </Animated.View>
          </View>
        ) : (
          isLoggedIn ? renderGameContent() : renderLoginScreen()
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7E8',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF8E8',
  },
  previewToggle: {
    backgroundColor: '#3B2A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 16,
  },
  previewToggleText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  autoScaleToggle: {
    marginTop: 8,
    backgroundColor: '#F4E7C8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  autoScaleText: {
    color: '#7A5600',
    fontWeight: '700',
    fontSize: 12,
  },
  phoneShell: {
    backgroundColor: '#111111',
    borderRadius: 36,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  phoneBezel: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2F2F2F',
  },
  notch: {
    width: 110,
    height: 24,
    backgroundColor: '#111111',
    alignSelf: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: '#FFF7E8',
  },
  phoneScreenSafeArea: {
    flex: 1,
    backgroundColor: '#FFF7E8',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
    position: 'relative',
  },
  headerCard: {
    width: '100%',
    backgroundColor: '#FFFDF7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F2E0BC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
  },
  logoutButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F4E7C8',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F2E0BC',
    gap: 6,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  summaryBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E9E5B',
    backgroundColor: '#E9F7EE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  highlightBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E5B00',
    backgroundColor: '#FFF2CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  summaryText: {
    fontSize: 12,
    color: '#6B5B47',
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A5600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  authCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  authTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  authHint: {
    fontSize: 12,
    color: '#8D7554',
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E7D6B8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#3B2A1A',
    backgroundColor: '#FFFDF7',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#8D7554',
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: '#8D7554',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 8,
  },
  cardCelebrating: {
    borderWidth: 2,
    borderColor: '#FFC83D',
    shadowColor: '#FFC83D',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  cardAnimating: {
    transform: [{ scale: 1.04 }, { rotate: '1deg' }],
  },
  introOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(59, 42, 26, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    zIndex: 10,
  },
  introCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  introSubtitle: {
    fontSize: 13,
    color: '#8D7554',
    lineHeight: 18,
  },
  introStepList: {
    gap: 10,
  },
  introStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  introStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFC83D',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  introStepText: {
    flex: 1,
    fontSize: 13,
    color: '#5C4A35',
    lineHeight: 18,
  },
  introButton: {
    backgroundColor: '#FFC83D',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  introButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  emoji: {
    fontSize: 72,
  },
  emojiAnimating: {
    transform: [{ rotate: '12deg' }, { translateY: -4 }],
  },
  levelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B2A1A',
  },
  levelBadge: {
    fontSize: 14,
    color: '#9A8B75',
    marginTop: 4,
  },
  progressTrack: {
    width: '80%',
    height: 10,
    backgroundColor: '#F0E6D2',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFC83D',
    borderRadius: 999,
  },
  messageBox: {
    width: '100%',
    minHeight: 64,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  messageText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  rankHint: {
    fontSize: 11,
    color: '#8E5B00',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  messageSpark: {
    position: 'absolute',
    right: 10,
    top: 8,
    fontSize: 16,
  },
  ticketText: {
    fontSize: 14,
    color: '#6B5B47',
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#FFFDF7',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2E0BC',
  },
  metaLabel: {
    fontSize: 11,
    color: '#9A8B75',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  mainButton: {
    width: '100%',
    backgroundColor: '#FFC83D',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F2C74A',
  },
  adButton: {
    width: '100%',
    backgroundColor: '#4A90E2',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#3D7ED0',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  mainButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B2A1A',
  },
  homeIndicator: {
    width: 120,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    opacity: 0.7,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  adButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  doneBanner: {
    width: '100%',
    backgroundColor: '#2E9E5B',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#24924E',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
