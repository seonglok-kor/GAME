import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

const AD_DURATION_SECONDS = 30;

type OutcomeTone = 'good' | 'neutral' | 'bad';

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

export default function App() {
  const [level, setLevel] = useState(0);
  const [tickets, setTickets] = useState(DAILY_TICKETS);
  const [message, setMessage] = useState('말랑이를 조물조물해서 최종 형태를 완성하세요!');
  const [tone, setTone] = useState<OutcomeTone>('neutral');
  const [isBusy, setIsBusy] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(AD_DURATION_SECONDS);
  const adTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const isComplete = level === MAX_LEVEL;

  useEffect(() => {
    return () => {
      if (adTimer.current) clearInterval(adTimer.current);
    };
  }, []);

  function handleReinforce() {
    if (isBusy || isComplete || tickets <= 0) return;

    setIsBusy(true);
    setTickets((t) => t - 1);
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
    }, 500);
  }

  function startAd() {
    if (isWatchingAd) return;
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>🧸 말랑말랑 진화 연구소 🧪</Text>

        <View style={styles.card}>
          <Text style={styles.emoji}>{LEVEL_NAMES[level].split(' ')[0]}</Text>
          <Text style={styles.levelName}>{LEVEL_NAMES[level].split(' ').slice(1).join(' ')}</Text>
          <Text style={styles.levelBadge}>Lv. {level} / {MAX_LEVEL}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(level / MAX_LEVEL) * 100}%` }]} />
          </View>
        </View>

        <View style={[styles.messageBox, { borderColor: TONE_COLORS[tone] }]}>
          <Text style={[styles.messageText, { color: TONE_COLORS[tone] }]}>{message}</Text>
        </View>

        <Text style={styles.ticketText}>🎟 남은 조물조물 횟수: {tickets}회</Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF7E8',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    color: '#3B2A1A',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 8,
  },
  emoji: {
    fontSize: 72,
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
  },
  messageText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  ticketText: {
    fontSize: 14,
    color: '#6B5B47',
  },
  mainButton: {
    width: '100%',
    backgroundColor: '#FFC83D',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  adButton: {
    width: '100%',
    backgroundColor: '#4A90E2',
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  mainButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B2A1A',
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
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
