import random
import time

LEVEL_NAMES = {
    0: "💧 맹물",
    1: "🧪 끈적한 콧물 액체",
    2: "🧋 펄 타피오카 덩어리",
    3: "🐸 개구리 알 젤리",
    4: "🍮 탱글탱글 푸딩",
    5: "🥣 파츠 슬라임",
    6: "🥛 클라우드 슬라임",
    7: "🍡 쫀득한 찹쌀떡",
    8: "🧼 거품 몽글이",
    9: "🐹 햄스터 볼따구",
    10: "🥟 고기만두 말랑이",
    11: "🧀 모짜렐라 말랑이",
    12: "🐙 문어 빨판 뽁뽁이",
    13: "🧊 셔벗 말랑이",
    14: "👽 외계 네온 말랑이",
    15: "🌌 갤럭시 말랑이",
    16: "✨ 유니콘 똥 말랑이",
    17: "👑 국왕의 소파 쿠션",
    18: "🌌 블랙홀 액체 괴물",
    19: "🧱 딱딱해지는 찰흙",
    20: "🗿 [최종] 전설의 모아이 석상 돌"
}


def get_outcome_weights(level):
    """
    결과 순서:
    +2, +1, 유지, -1, -2

    숫자는 각각의 결과가 나올 가중치다.
    전체 합계는 100으로 구성했다.
    """

    if level < 5:
        return [15, 60, 20, 5, 0]

    elif level < 10:
        return [10, 45, 25, 15, 5]

    elif level < 14:
        return [5, 30, 30, 25, 10]

    elif level < 17:
        return [3, 20, 30, 30, 17]

    elif level < 19:
        return [1, 12, 27, 35, 25]

    elif level == 19:
        # 19단계에서는 +2도 최종 단계인 20으로 처리된다.
        return [1, 4, 20, 40, 35]

    return [0, 0, 100, 0, 0]


def reinforce_mallangi(current_level):
    changes = [2, 1, 0, -1, -2]
    weights = get_outcome_weights(current_level)

    change = random.choices(
        population=changes,
        weights=weights,
        k=1
    )[0]

    new_level = current_level + change

    # 단계가 0 아래나 20 위로 벗어나지 않도록 제한
    new_level = max(0, min(20, new_level))

    # 실제 변화량 계산
    # 예: 0단계에서 -2가 나와도 실제로는 0단계 유지
    actual_change = new_level - current_level

    return new_level, change, actual_change


def print_result(old_level, new_level, selected_change, actual_change):
    if selected_change == 2:
        print("\n🌟 대성공! 말랑이가 엄청난 탄력을 얻었습니다!")

    elif selected_change == 1:
        print("\n✨ 강화 성공! 말랑함이 한 단계 상승했습니다!")

    elif selected_change == 0:
        print("\n😐 변화 없음! 너무 살살 조물거렸습니다.")

    elif selected_change == -1:
        print("\n💦 강화 약화! 말랑이가 조금 찌그러졌습니다.")

    elif selected_change == -2:
        print("\n💥 대실패! 말랑이의 형태가 크게 무너졌습니다!")

    # 최저 단계에서는 -1, -2가 나와도 0단계 아래로 내려갈 수 없음
    if selected_change != actual_change:
        print("🛡️ 최저 단계 보호로 0단계에서 멈췄습니다.")

    if old_level != new_level:
        sign = "+" if actual_change > 0 else ""
        print(f"📊 단계 변화: {old_level} → {new_level} ({sign}{actual_change})")
        print(f"▶ 현재 말랑이: {LEVEL_NAMES[new_level]}\n")
    else:
        print(f"▶ 현재 말랑이: {LEVEL_NAMES[new_level]}\n")


def play_mallangi_20():
    current_level = 0
    tickets = 10

    print("==================================================")
    print("       🧸 말랑말랑 진화 연구소 🧪")
    print("==================================================")
    print("말랑이를 조물조물해서 최종 형태를 완성하세요!")
    print("강화 결과: 대성공 / 성공 / 유지 / 약화 / 대실패\n")

    while True:
        print(f"▶ 현재 내 말랑이: {LEVEL_NAMES[current_level]}")
        print(f"▶ 현재 단계: {current_level}단계")
        print(f"▶ 남은 조물조물 횟수: {tickets}회")

        if current_level == 20:
            print("\n🎉 최종 말랑이 완성!")
            print("🗿 전설의 모아이 석상 돌을 탄생시켰습니다!")
            break

        if tickets <= 0:
            print("\n😢 조물조물 횟수를 모두 사용했습니다.")

            choice = input(
                "👉 광고를 보고 조물조물 횟수 10회 충전 (y/n): "
            ).strip().lower()

            if choice == "y":
                print("🎬 광고 재생 중...")
                time.sleep(2)

                tickets = 10
                print("✨ 조물조물 횟수 10회 충전 완료!\n")
                continue

            print("게임을 종료합니다.")
            break

        action = input(
            "👉 말랑이를 조물조물하기 (엔터 / 종료 q): "
        ).strip().lower()

        if action == "q":
            print("게임을 종료합니다.")
            break

        tickets -= 1
        old_level = current_level

        print("조물... 쪼물... 꾸욱...", end="", flush=True)
        time.sleep(0.5)

        current_level, selected_change, actual_change = reinforce_mallangi(
            current_level
        )

        print_result(
            old_level,
            current_level,
            selected_change,
            actual_change
        )

        print("--------------------------------------------------")


if __name__ == "__main__":
    play_mallangi_20()