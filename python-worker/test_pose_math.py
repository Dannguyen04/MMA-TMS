"""
test_pose_math.py — Unit tests cho pose_math.py và kick_analyzer.py
Chạy: python test_pose_math.py
"""

import sys
# Fix emoji output trên Windows terminal
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")


import math
import sys
from pathlib import Path

# ─── Inline test runner (không cần pytest) ───
_PASS = 0
_FAIL = 0

def check(name: str, condition: bool, detail: str = ""):
    global _PASS, _FAIL
    if condition:
        print(f"  ✅ {name}")
        _PASS += 1
    else:
        print(f"  ❌ {name}{' — ' + detail if detail else ''}")
        _FAIL += 1

def approx(a, b, tol=1.0):
    return abs(a - b) <= tol


# ─── Import modules ───
sys.path.insert(0, str(Path(__file__).parent))
from pose_math import (
    Point, EMAState,
    calculate_angle, apply_ema, calculate_speed,
    detect_active_leg, parse_yolo_keypoints,
)
from kick_analyzer import KickAnalyzer, KickState


# ════════════════════════════════════════════════
# Test: calculate_angle
# ════════════════════════════════════════════════
print("\n📐 calculate_angle")

# Góc vuông 90°: A=(0,1), B=(0,0), C=(1,0)
a = Point(0, 1); b = Point(0, 0); c = Point(1, 0)
angle = calculate_angle(a, b, c)
check("Góc vuông 90°", approx(angle, 90.0), f"got {angle:.1f}°")

# Góc thẳng 180°: A=(-1,0), B=(0,0), C=(1,0)
a = Point(-1, 0); b = Point(0, 0); c = Point(1, 0)
angle = calculate_angle(a, b, c)
check("Góc thẳng 180°", approx(angle, 180.0), f"got {angle:.1f}°")

# Góc 45°
a = Point(0, 1); b = Point(0, 0); c = Point(1, 1)
angle = calculate_angle(a, b, c)
check("Góc 45°", approx(angle, 45.0, tol=1.5), f"got {angle:.1f}°")

# None input → None
check("None input → None", calculate_angle(None, None, None) is None)

# Low confidence input → None
check("Low confidence input → None", calculate_angle(Point(0, 1, 0.9), Point(0, 0, 0.1), Point(1, 0, 0.9)) is None)

# Degenerate near-zero vector → None
check("Degenerate near-zero vector → None", calculate_angle(Point(0, 0.005), Point(0, 0), Point(1, 0)) is None)


# ════════════════════════════════════════════════
# Test: apply_ema
# ════════════════════════════════════════════════
print("\n📉 apply_ema (EMA filter)")

state = EMAState()
p1 = Point(1.0, 0.0)
out1 = apply_ema(p1, state, alpha=0.5)
check("First call = raw value", approx(out1.x, 1.0))

p2 = Point(0.0, 0.0)
out2 = apply_ema(p2, state, alpha=0.5)
check("Second call EMA", approx(out2.x, 0.5), f"got {out2.x}")

# Nhiều lần hội tụ về 0
for _ in range(20):
    out = apply_ema(p2, state, alpha=0.5)
check("Hội tụ về 0 sau 20 frames", out.x < 0.01, f"got {out.x:.4f}")


# ════════════════════════════════════════════════
# Test: calculate_speed
# ════════════════════════════════════════════════
print("\n⚡ calculate_speed")

prev = Point(0.0, 0.0)
curr = Point(0.1, 0.0)  # di chuyển 0.1 trong 100ms
spd = calculate_speed(prev, curr, dt_ms=100)
check("Speed 0.1/100ms = 1.0 u/s", approx(spd, 1.0), f"got {spd:.2f}")

check("dt=0 → 0", calculate_speed(prev, curr, dt_ms=0) == 0)
check("prev=None → 0", calculate_speed(None, curr, dt_ms=100) == 0)


# ════════════════════════════════════════════════
# Test: detect_active_leg
# ════════════════════════════════════════════════
print("\n🦵 detect_active_leg")

# Tạo 17 landmarks mặc định đứng thẳng
def make_landmarks(left_ankle_y=0.9, right_ankle_y=0.9):
    kps = [Point(0.5, 0.5, 0.9)] * 17
    # LEFT_HIP=11, LEFT_ANKLE=15
    kps[11] = Point(0.4, 0.6, 0.9)   # left hip
    kps[12] = Point(0.6, 0.6, 0.9)   # right hip
    kps[15] = Point(0.4, left_ankle_y, 0.9)
    kps[16] = Point(0.6, right_ankle_y, 0.9)
    return kps

# Chân trái đang đá (ankle lên cao → y nhỏ hơn hip)
kps = make_landmarks(left_ankle_y=0.3, right_ankle_y=0.9)
check("Chân trái đang đá", detect_active_leg(kps) == "left")

# Chân phải đang đá
kps = make_landmarks(left_ankle_y=0.9, right_ankle_y=0.3)
check("Chân phải đang đá", detect_active_leg(kps) == "right")

# Đứng thẳng → none
kps = make_landmarks(0.9, 0.9)
check("Đứng thẳng → none", detect_active_leg(kps) == "none")


# ════════════════════════════════════════════════
# Test: KickAnalyzer state machine
# ════════════════════════════════════════════════
print("\n🥋 KickAnalyzer state machine")

analyzer = KickAnalyzer()
check("Initial state = IDLE", analyzer.state == KickState.IDLE)

dummy_ankle = Point(0.5, 0.9)

# Đứng thẳng: không chuyển trạng thái
for _ in range(5):
    analyzer.update(170.0, 90.0, dummy_ankle, 0, 0.0)
check("Đứng thẳng vẫn IDLE", analyzer.state == KickState.IDLE)

# Rút gối xuống 100°
analyzer.update(100.0, 90.0, dummy_ankle, 1, 33.0)
check("Gập gối < 120° → CHAMBERING", analyzer.state == KickState.CHAMBERING)

# Rút sâu hơn
analyzer.update(60.0, 90.0, dummy_ankle, 2, 66.0)
check("minChamberAngle = 60", approx(analyzer.min_chamber_angle, 60.0))

# Bung chân ra nhanh với speed cao
fast_ankle = Point(0.5, 0.3)   # ankle lên nhanh
analyzer.peak_speed = 1.0      # mô phỏng tốc độ cao
analyzer.update(90.0, 90.0, fast_ankle, 3, 100.0)
check("Bung từ 60° lên 90° + speed > 0.4 → EXTENDING", analyzer.state == KickState.EXTENDING)

# Bung tiếp
analyzer.update(160.0, 90.0, fast_ankle, 4, 133.0)
check("maxExtensionAngle = 160", approx(analyzer.max_extension_angle, 160.0))

# Thu chân về: góc giảm > 15°
result = analyzer.update(140.0, 90.0, dummy_ankle, 5, 166.0)
check("Thu chân → RECOVERING + có KickResult", analyzer.state == KickState.RECOVERING)
check("KickResult không None", result is not None)

if result:
    check("Score > 0", result.score > 0)
    check("Grade là chuỗi", isinstance(result.grade, str))
    check("details là list", isinstance(result.details, list))
    check("to_dict() có đủ keys",
          all(k in result.to_dict() for k in ["score", "grade", "emoji", "details"]))
    print(f"     → Score: {result.score}, Grade: {result.emoji} {result.grade}")
    print(f"     → {' | '.join(result.details)}")

# Thu về IDLE
analyzer.update(170.0, 90.0, dummy_ankle, 6, 200.0)
check("Về thẳng → IDLE", analyzer.state == KickState.IDLE)

# Kiểm tra lịch sử
check("1 cú đá trong results", len(analyzer.results) == 1)


# ════════════════════════════════════════════════
# Tổng kết
# ════════════════════════════════════════════════
print(f"\n{'='*50}")
total = _PASS + _FAIL
print(f"Kết quả: {_PASS}/{total} tests passed", end="")
if _FAIL:
    print(f" ({_FAIL} FAILED)")
    sys.exit(1)
else:
    print(" ✅ ALL PASSED")
