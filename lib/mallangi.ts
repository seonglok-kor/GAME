export const LEVEL_NAMES: Record<number, string> = {
  0: '💧 맹물',
  1: '🧪 끈적한 콧물 액체',
  2: '🧋 펄 타피오카 덩어리',
  3: '🐸 개구리 알 젤리',
  4: '🍮 탱글탱글 푸딩',
  5: '🥣 파츠 슬라임',
  6: '🥛 클라우드 슬라임',
  7: '🍡 쫀득한 찹쌀떡',
  8: '🧼 거품 몽글이',
  9: '🐹 햄스터 볼따구',
  10: '🥟 고기만두 말랑이',
  11: '🧀 모짜렐라 말랑이',
  12: '🐙 문어 빨판 뽁뽁이',
  13: '🧊 셔벗 말랑이',
  14: '👽 외계 네온 말랑이',
  15: '🌌 갤럭시 말랑이',
  16: '✨ 유니콘 똥 말랑이',
  17: '👑 국왕의 소파 쿠션',
  18: '🌌 블랙홀 액체 괴물',
  19: '🧱 딱딱해지는 찰흙',
  20: '🗿 [최종] 전설의 모아이 석상 돌',
};

export const MAX_LEVEL = 20;
export const DAILY_TICKETS = 10;
export const AD_REWARD_TICKETS = 2;

// 결과 순서: +2, +1, 유지, -1, -2 (가중치 합계 100)
function getOutcomeWeights(level: number): number[] {
  if (level < 5) return [15, 60, 20, 5, 0];
  if (level < 10) return [10, 45, 25, 15, 5];
  if (level < 14) return [5, 30, 30, 25, 10];
  if (level < 17) return [3, 20, 30, 30, 17];
  if (level < 19) return [1, 12, 27, 35, 25];
  if (level === 19) return [1, 4, 20, 40, 35];
  return [0, 0, 100, 0, 0];
}

function weightedRandomChange(weights: number[]): number {
  const changes = [2, 1, 0, -1, -2];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < changes.length; i++) {
    roll -= weights[i];
    if (roll < 0) return changes[i];
  }
  return changes[changes.length - 1];
}

export interface ReinforceResult {
  newLevel: number;
  selectedChange: number;
  actualChange: number;
}

export function reinforceMallangi(currentLevel: number): ReinforceResult {
  const weights = getOutcomeWeights(currentLevel);
  const selectedChange = weightedRandomChange(weights);

  const newLevel = Math.max(0, Math.min(MAX_LEVEL, currentLevel + selectedChange));
  const actualChange = newLevel - currentLevel;

  return { newLevel, selectedChange, actualChange };
}

export type OutcomeKind = 'great_success' | 'success' | 'no_change' | 'weaken' | 'great_fail';

export function outcomeKind(selectedChange: number): OutcomeKind {
  switch (selectedChange) {
    case 2:
      return 'great_success';
    case 1:
      return 'success';
    case 0:
      return 'no_change';
    case -1:
      return 'weaken';
    default:
      return 'great_fail';
  }
}

export const OUTCOME_MESSAGES: Record<OutcomeKind, string> = {
  great_success: '🌟 대성공! 말랑이가 엄청난 탄력을 얻었습니다!',
  success: '✨ 강화 성공! 말랑함이 한 단계 상승했습니다!',
  no_change: '😐 변화 없음! 너무 살살 조물거렸습니다.',
  weaken: '💦 강화 약화! 말랑이가 조금 찌그러졌습니다.',
  great_fail: '💥 대실패! 말랑이의 형태가 크게 무너졌습니다!',
};
