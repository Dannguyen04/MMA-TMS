"""One-shot generator for assets/splash/fighter-punch.json. Not imported by the app."""

from __future__ import annotations

import json
from pathlib import Path

CYAN = [0.133, 0.882, 1, 1]
CYAN_DIM = [0.133, 0.882, 1, 0.45]
CRIMSON = [1.0, 0.176, 0.333, 1]
WHITE = [0.96, 0.97, 0.98, 1]

FR = 60
OP = 72  # 1.2s loop


def val(v):
    return {"a": 0, "k": v}


def rot_keys(frames: list[tuple[float, float]], ease: str = "punch"):
    """Modern Lottie rotation keyframes. frames: (t, degrees)."""
    keys = []
    for i, (t, s) in enumerate(frames):
        kf: dict = {"t": t, "s": [s]}
        if i < len(frames) - 1:
            if ease == "snap" and i == 1:
                kf["i"] = {"x": [0.12], "y": [1]}
                kf["o"] = {"x": [0.75], "y": [0]}
            elif ease == "hold" and frames[i + 1][1] == s:
                kf["i"] = {"x": [0.5], "y": [1]}
                kf["o"] = {"x": [0.5], "y": [0]}
            else:
                kf["i"] = {"x": [0.42], "y": [1]}
                kf["o"] = {"x": [0.58], "y": [0]}
        keys.append(kf)
    return {"a": 1, "k": keys}


def num_keys(frames: list[tuple[float, float]]):
    keys = []
    for i, (t, s) in enumerate(frames):
        kf: dict = {"t": t, "s": [s]}
        if i < len(frames) - 1:
            kf["i"] = {"x": [0.4], "y": [1]}
            kf["o"] = {"x": [0.6], "y": [0]}
        keys.append(kf)
    return {"a": 1, "k": keys}


def tr(p, a=None, s=None, r=None, o=100):
    return {
        "ty": "tr",
        "p": p if isinstance(p, dict) else val(p),
        "a": a if isinstance(a, dict) else val(a or [0, 0]),
        "s": s if isinstance(s, dict) else val(s or [100, 100]),
        "r": r if isinstance(r, dict) else val(r or 0),
        "o": o if isinstance(o, dict) else val(o),
        "sk": val(0),
        "sa": val(0),
    }


def st(color, w, o=100):
    return {
        "ty": "st",
        "c": val(color),
        "o": val(o),
        "w": val(w),
        "lc": 2,
        "lj": 2,
        "ml": 4,
        "nm": "Stroke",
    }


def el(size, pos=(0, 0)):
    return {"ty": "el", "p": val(list(pos)), "s": val(list(size)), "nm": "El"}


def rc(size, pos=(0, 0), radius=8):
    return {"ty": "rc", "p": val(list(pos)), "s": val(list(size)), "r": val(radius), "nm": "Rc"}


def path(verts, closed=False):
    n = len(verts)
    return {
        "ty": "sh",
        "ks": val({"c": closed, "v": verts, "i": [[0, 0]] * n, "o": [[0, 0]] * n}),
        "nm": "Path",
    }


def group(name, items, p=None, r=None, s=None, o=100):
    it = list(items)
    it.append(tr(p or [0, 0], r=r, s=s, o=o))
    return {"ty": "gr", "nm": name, "it": it}


def ellipse_gr(name, size, pos, stroke_w=1.4, color=CYAN, o=100):
    return group(name, [el(size), st(color, stroke_w)], p=list(pos), o=o)


def capsule_gr(name, length, thick, pos, rot=0, color=CYAN, w=1.6):
    return group(name, [rc([length, thick], [length / 2, 0], thick / 2), st(color, w)], p=list(pos), r=rot)


def layer(ind, name, shapes, p, r=0, parent=None, ip=0, op=OP, o=100, s=None):
    ks = {
        "o": o if isinstance(o, dict) else val(o),
        "r": r if isinstance(r, dict) else val(r),
        "p": p if isinstance(p, dict) else val(p),
        "a": val([0, 0]),
        "s": s if isinstance(s, dict) else val(s or [100, 100]),
        "sk": val(0),
        "sa": val(0),
    }
    lyr = {
        "ddd": 0,
        "ind": ind,
        "ty": 4,
        "nm": name,
        "sr": 1,
        "ks": ks,
        "ao": 0,
        "shapes": shapes,
        "ip": ip,
        "op": op,
        "st": 0,
        "bm": 0,
    }
    if parent is not None:
        lyr["parent"] = parent
    return lyr


# Punch timeline (degrees). 0° = arm along +X (to the right).
# Guard: bent, fist by chin. Snap to full extension. Hold. Retract.
UPPER = rot_keys(
    [
        (0, 58),
        (8, 68),  # chamber / pull-back
        (24, -14),  # SNAP to almost horizontal
        (32, -20),  # follow-through
        (40, -16),
        (72, 58),
    ],
    ease="punch",
)
FORE = rot_keys(
    [
        (0, 108),
        (8, 118),
        (24, 8),
        (32, 2),
        (40, 10),
        (72, 108),
    ],
    ease="punch",
)
TORSO = rot_keys([(0, -3), (8, -6), (24, 7), (32, 5), (72, -3)])
FIST_SCALE = {
    "a": 1,
    "k": [
        {"t": 0, "s": [100, 100], "i": {"x": [0.4, 0.4], "y": [1, 1]}, "o": {"x": [0.6, 0.6], "y": [0, 0]}},
        {"t": 8, "s": [96, 96], "i": {"x": [0.15, 0.15], "y": [1, 1]}, "o": {"x": [0.7, 0.7], "y": [0, 0]}},
        {"t": 24, "s": [118, 118], "i": {"x": [0.4, 0.4], "y": [1, 1]}, "o": {"x": [0.6, 0.6], "y": [0, 0]}},
        {"t": 32, "s": [108, 108], "i": {"x": [0.4, 0.4], "y": [1, 1]}, "o": {"x": [0.6, 0.6], "y": [0, 0]}},
        {"t": 72, "s": [100, 100]},
    ],
}
TRAIL_TRIM = num_keys([(0, 0), (8, 8), (24, 100), (40, 100), (56, 0), (72, 0)])
TRAIL_OP = num_keys([(0, 20), (8, 35), (24, 100), (36, 80), (56, 15), (72, 20)])
IMPACT_O = num_keys([(0, 0), (20, 0), (24, 100), (34, 0), (72, 0)])

layers = []

# --- trails (top-most visually = first in list) ---
layers.append(
    layer(
        1,
        "ImpactBurst",
        [
            group(
                "Burst",
                [
                    el([46, 46]),
                    st(CYAN, 2, 80),
                    el([22, 22]),
                    st(WHITE, 1.2, 90),
                ],
                o=IMPACT_O,
            )
        ],
        p=[268, 148],
    )
)

trail_path = {
    "ty": "gr",
    "nm": "CyanTrail",
    "it": [
        {
            "ty": "sh",
            "ks": val(
                {
                    "c": False,
                    "v": [[40, 390], [90, 250], [160, 170], [250, 155]],
                    "i": [[0, 0], [-30, 40], [-30, 20], [-20, 5]],
                    "o": [[40, -50], [30, -30], [30, -8], [0, 0]],
                }
            ),
        },
        st(CYAN, 3),
        {
            "ty": "tm",
            "s": val(0),
            "e": TRAIL_TRIM,
            "o": val(0),
            "nm": "Trim",
        },
        tr([0, 0], o=TRAIL_OP),
    ],
}
kick_path = {
    "ty": "gr",
    "nm": "CrimsonTrail",
    "it": [
        {
            "ty": "sh",
            "ks": val(
                {
                    "c": False,
                    "v": [[70, 460], [95, 250], [165, 140], [250, 155]],
                    "i": [[0, 0], [-10, 50], [-25, 30], [-20, 5]],
                    "o": [[10, -80], [25, -40], [30, -5], [0, 0]],
                }
            ),
        },
        st(CRIMSON, 3.2, 85),
        {
            "ty": "tm",
            "s": val(0),
            "e": TRAIL_TRIM,
            "o": val(0),
            "nm": "Trim",
        },
        tr([0, 0], o=TRAIL_OP),
    ],
}
layers.append(layer(2, "Trails", [trail_path, kick_path], p=[0, 0]))

# Fist (child of forearm)
layers.append(
    layer(
        12,
        "Fist",
        [
            group("FistMesh", [el([26, 26]), st(CYAN, 2.2), el([14, 14]), st(CYAN, 1.2), el([6, 6]), st(WHITE, 1)]),
        ],
        p=[50, 0],
        parent=11,
        s=FIST_SCALE,
    )
)

# Forearm
layers.append(
    layer(
        11,
        "Forearm",
        [group("Bone", [rc([50, 15], [25, 0], 7.5), st(CYAN, 1.8), rc([36, 7], [24, 0], 3.5), st(CYAN_DIM, 1)])],
        p=[54, 0],
        r=FORE,
        parent=10,
    )
)

# Upper arm (pivot = punching shoulder)
layers.append(
    layer(
        10,
        "UpperArm",
        [group("Bone", [rc([54, 18], [27, 0], 9), st(CYAN, 1.8), rc([38, 8], [26, 0], 4), st(CYAN_DIM, 1)])],
        p=[31, -64],
        r=UPPER,
        parent=20,
    )
)

# Guard arm (left / rear)
guard_fore = rot_keys([(0, 95), (24, 88), (72, 95)])
layers.append(
    layer(
        16,
        "GuardFist",
        [group("GFist", [el([20, 20]), st(CYAN, 1.8), el([10, 10]), st(CYAN, 1)])],
        p=[42, 0],
        parent=15,
    )
)
layers.append(
    layer(
        15,
        "GuardFore",
        [group("Bone", [rc([42, 13], [21, 0], 6.5), st(CYAN, 1.5)])],
        p=[46, 0],
        r=guard_fore,
        parent=14,
    )
)
layers.append(
    layer(
        14,
        "GuardUpper",
        [group("Bone", [rc([46, 16], [23, 0], 8), st(CYAN, 1.6)])],
        p=[-29, -60],
        r=rot_keys([(0, 128), (24, 138), (72, 128)]),
        parent=20,
    )
)

# Head
layers.append(
    layer(
        21,
        "Head",
        [
            group("Skull", [el([46, 56]), st(CYAN, 1.8), el([30, 38]), st(CYAN, 1.1), el([16, 20]), st(CYAN_DIM, 1)]),
            group("Brow", [path([[-10, -6], [10, -8]]), st(CYAN, 1.2)], p=[4, -4]),
        ],
        p=[5, -120],
        parent=20,
        r=rot_keys([(0, -4), (24, 6), (72, -4)]),
    )
)

# Torso mesh
torso_shapes = [
    group("Ribcage", [el([78, 96]), st(CYAN, 1.8), el([54, 72]), st(CYAN, 1.15), el([30, 46]), st(CYAN_DIM, 1)]),
    group(
        "Lattice",
        [
            path([[-28, -30], [28, 30]]),
            path([[28, -30], [-28, 30]]),
            path([[-32, 0], [32, 0]]),
            path([[0, -40], [0, 42]]),
            st(CYAN, 0.9, 70),
        ],
    ),
]
layers.append(layer(22, "Torso", torso_shapes, p=[1, -32], parent=20))

# Hips
layers.append(
    layer(
        23,
        "Hips",
        [group("Pelvis", [el([62, 28]), st(CYAN, 1.6), el([36, 16]), st(CYAN, 1)])],
        p=[-3, 38],
        parent=20,
    )
)

# Legs
layers.append(
    layer(
        32,
        "LShin",
        [group("Bone", [rc([88, 16], [44, 0], 8), st(CYAN, 1.5)])],
        p=[82, 0],
        r=rot_keys([(0, 12), (24, 6), (72, 12)]),
        parent=31,
    )
)
layers.append(
    layer(
        31,
        "LThigh",
        [group("Bone", [rc([82, 22], [41, 0], 11), st(CYAN, 1.7)])],
        p=[-19, 52],
        r=rot_keys([(0, 72), (24, 64), (72, 72)]),
        parent=20,
    )
)
layers.append(
    layer(
        34,
        "RShin",
        [group("Bone", [rc([90, 16], [45, 0], 8), st(CYAN, 1.5)])],
        p=[84, 0],
        r=rot_keys([(0, 8), (24, 16), (72, 8)]),
        parent=33,
    )
)
layers.append(
    layer(
        33,
        "RThigh",
        [group("Bone", [rc([84, 22], [42, 0], 11), st(CYAN, 1.7)])],
        p=[13, 50],
        r=rot_keys([(0, 108), (24, 118), (72, 108)]),
        parent=20,
    )
)
# Feet
layers.append(
    layer(
        35,
        "LFoot",
        [group("Foot", [el([28, 12]), st(CYAN, 1.4)])],
        p=[86, 4],
        parent=32,
        r=val(-80),
    )
)
layers.append(
    layer(
        36,
        "RFoot",
        [group("Foot", [el([28, 12]), st(CYAN, 1.4)])],
        p=[88, 4],
        parent=34,
        r=val(-100),
    )
)

# Root torso (breath + twist)
layers.append(
    layer(
        20,
        "Root",
        [group("Anchor", [el([4, 4]), st(CYAN, 0.5, 0)])],
        p=[167, 210],
        r=TORSO,
        s={
            "a": 1,
            "k": [
                {"t": 0, "s": [100, 100], "i": {"x": [0.42, 0.42], "y": [1, 1]}, "o": {"x": [0.58, 0.58], "y": [0, 0]}},
                {"t": 36, "s": [102, 102], "i": {"x": [0.42, 0.42], "y": [1, 1]}, "o": {"x": [0.58, 0.58], "y": [0, 0]}},
                {"t": 72, "s": [100, 100]},
            ],
        },
    )
)

# Lottie paints first array item ON TOP. Parent refs use `ind`, not array index.
# Keep root (20) in the list; children can appear before parents in the array.
doc = {
    "v": "5.7.4",
    "fr": FR,
    "ip": 0,
    "op": OP,
    "w": 334,
    "h": 520,
    "nm": "MMA Wireframe Punch",
    "ddd": 0,
    "assets": [],
    "layers": layers,
}

out = Path(__file__).resolve().parents[1] / "assets" / "splash" / "fighter-punch.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size} bytes, {len(layers)} layers)")
