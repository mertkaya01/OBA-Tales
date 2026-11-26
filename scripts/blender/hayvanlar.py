"""
OBA-Tales · Kutada'nın hayvanları: geyik, tavşan, kuş.

Blender arka planda çalıştırır (npm run blender:hayvanlar → scripts/blender/calistir.ts hayvanlar):
    blender --background --factory-startup --python hayvanlar.py -- <cikti_dizini> <onizleme_dizini> [tur,tur]

Her hayvan için:
  1. Düşük poligonlu gövde koddan kurulur (kutu, kesik koni); her parçanın malzeme adı "<tür>-<parça>"dır, renk
     malzemede durur. Oyunun köşeli, piksel üslubuna uyar.
  2. İskelet kurulur; her parça bir (ya da en yakın) kemiğe tam ağırlıkla bağlanır.
  3. Klipler kodla anahtar karelere yazılır, her biri ayrı NLA izinde:
       geyik:  dur, otla, yuru, kos, yigil
       tavşan: bekle, kemir, zipla, kac, yigil
       kuş:    dur, gagala, kanat, suzul, yigil
     yigil bir kez oynar ve son karesinde kalır (avlanan hayvan yere yığılır; kan yok).
  4. public/models/hayvan-<tür>.glb ve modeller/hayvanlar/<tür>-onizleme.png yazılır.

Birimler oyun dünyasının birimidir (kahraman ≈ 7,2 boyunda): oyunda ölçek 1.
Dönüşler kemiğin duruş yönünden bağımsız, iskelet uzayında verilir:
  x: yanal eksen (aşağı bakan bacakta + uç geriye, öne bakan boyunda + burun aşağı)
  y: ön-arka eksen (yuvarlanma; sol kanatta + uç aşağı)
  z: dikey eksen (baş sağa-sola)
Sağ taraf (.R) kemiklerinde y ve z aynalanır: simetrik hareket aynı sayılarla yazılır.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT_DIR = ARGV[0] if len(ARGV) > 0 else "public/models"
PREVIEW_DIR = ARGV[1] if len(ARGV) > 1 else "modeller/hayvanlar"
ONLY = ARGV[2].split(",") if len(ARGV) > 2 and ARGV[2] else None

FPS = 30
TAU = math.pi * 2


def g2b(p):
    """Oyun (x, y yukarı, z ön) → Blender (x, -z, y)."""
    return Vector((p[0], -p[2], p[1]))


def b2g(v):
    return (v.x, v.z, -v.y)


# ── Gövde parçaları ────────────────────────────────────────────────
# Her parça: (ad, renk, şekil, kemikler). Şekil: ("kutu", merkez, boyut[, eğim°(x,y,z), daralma])
#                                               ("koni", a, b, r1, r2[, kenar])
# kemikler: tek kemik ya da adaylar (köşe başına en yakın kemik seçilir).


def mirror_parts(parts):
    out = []
    for name, color, shape, bones in parts:
        out.append((name, color, shape, bones))
        if not name.endswith(".L"):
            continue
        flip = lambda p: (-p[0], p[1], p[2])
        if shape[0] == "kutu":
            s = list(shape)
            s[1] = flip(shape[1])
            if len(s) > 3:
                rot = s[3]
                s[3] = (rot[0], -rot[1], -rot[2])
            shape_r = tuple(s)
        else:
            shape_r = (shape[0], flip(shape[1]), flip(shape[2])) + tuple(shape[3:])
        bones_r = [b.replace(".L", ".R") for b in (bones if isinstance(bones, list) else [bones])]
        out.append((name[:-2] + ".R", color, shape_r, bones_r if isinstance(bones, list) else bones_r[0]))
    return out


def mirror_rig(rig):
    out = dict(rig)
    for name, (a, b) in rig.items():
        if name.endswith(".L"):
            out[name[:-2] + ".R"] = ((-a[0], a[1], a[2]), (-b[0], b[1], b[2]))
    return out


def mirror_parents(parents):
    out = dict(parents)
    for name, parent in parents.items():
        if name.endswith(".L"):
            out[name[:-2] + ".R"] = parent.replace(".L", ".R")
    return out


# Renkler (sıcak, doğal; piksel son işlemde okunaklı kalsın diye biraz doygun)
DEER_BODY = "#a46a40"
DEER_DARK = "#7c4c2c"
DEER_BELLY = "#ead8b8"
HOOF = "#2c2420"
ANTLER = "#dccb9e"
EYE = "#1b1414"
NOSE = "#2e2626"

SPECIES = {}

# ── Geyik ──────────────────────────────────────────────────────────
SPECIES["geyik"] = {
    "rig": mirror_rig(
        {
            "root": ((0, 0, 0), (0, 0.8, 0)),
            "hips": ((0, 3.15, -1.5), (0, 3.15, 0.05)),
            "chest": ((0, 3.15, 0.05), (0, 3.3, 1.45)),
            "neck": ((0, 3.55, 1.45), (0, 4.95, 2.3)),
            "head": ((0, 4.95, 2.3), (0, 4.95, 3.55)),
            "tail": ((0, 3.55, -1.85), (0, 3.15, -2.15)),
            "fl_up.L": ((0.42, 2.75, 1.2), (0.42, 1.5, 1.25)),
            "fl_lo.L": ((0.42, 1.5, 1.25), (0.42, 0.25, 1.25)),
            "hl_up.L": ((0.42, 2.95, -1.25), (0.42, 1.65, -1.5)),
            "hl_lo.L": ((0.42, 1.65, -1.5), (0.42, 0.25, -1.3)),
        }
    ),
    "parents": mirror_parents(
        {
            "hips": "root",
            "chest": "hips",
            "neck": "chest",
            "head": "neck",
            "tail": "hips",
            "fl_up.L": "chest",
            "fl_lo.L": "fl_up.L",
            "hl_up.L": "hips",
            "hl_lo.L": "hl_up.L",
        }
    ),
    "parts": mirror_parts(
        [
            ("govde", DEER_BODY, ("kutu", (0, 3.15, 0.0), (1.3, 1.35, 3.5), (0, 0, 0), 0.92), ["hips", "chest"]),
            ("gogus", DEER_BODY, ("kutu", (0, 3.35, 1.25), (1.2, 1.3, 1.0), (8, 0, 0)), "chest"),
            ("karin", DEER_BELLY, ("kutu", (0, 2.5, 0.05), (1.0, 0.18, 2.8)), ["hips", "chest"]),
            ("but", DEER_DARK, ("kutu", (0, 3.25, -1.35), (1.36, 1.25, 1.0), (-6, 0, 0)), "hips"),
            ("boyun", DEER_BODY, ("koni", (0, 3.45, 1.35), (0, 4.95, 2.35), 0.5, 0.33, 6), "neck"),
            ("bas", DEER_BODY, ("kutu", (0, 5.05, 2.6), (0.64, 0.72, 0.95), (6, 0, 0)), "head"),
            ("burun", DEER_DARK, ("kutu", (0, 4.88, 3.2), (0.46, 0.46, 0.62), (14, 0, 0)), "head"),
            ("burun-ucu", NOSE, ("kutu", (0, 4.83, 3.52), (0.32, 0.26, 0.1), (14, 0, 0)), "head"),
            ("goz.L", EYE, ("kutu", (0.33, 5.18, 2.8), (0.06, 0.13, 0.13)), "head"),
            ("kulak.L", DEER_DARK, ("kutu", (0.42, 5.42, 2.35), (0.42, 0.14, 0.24), (0, -14, 28)), "head"),
            ("boynuz.L", ANTLER, ("koni", (0.16, 5.4, 2.45), (0.5, 6.55, 2.2), 0.07, 0.05, 5), "head"),
            ("boynuz-dal.L", ANTLER, ("koni", (0.36, 6.05, 2.32), (0.62, 6.3, 2.7), 0.05, 0.035, 5), "head"),
            ("boynuz-uc.L", ANTLER, ("koni", (0.45, 6.4, 2.25), (0.85, 6.75, 2.0), 0.045, 0.03, 5), "head"),
            ("kuyruk", DEER_BELLY, ("kutu", (0, 3.45, -1.95), (0.32, 0.5, 0.24), (-30, 0, 0)), "tail"),
            ("on-ust.L", DEER_BODY, ("koni", (0.42, 2.85, 1.2), (0.42, 1.5, 1.25), 0.24, 0.15, 6), "fl_up.L"),
            ("on-alt.L", DEER_DARK, ("koni", (0.42, 1.5, 1.25), (0.42, 0.24, 1.25), 0.13, 0.11, 5), "fl_lo.L"),
            ("on-toynak.L", HOOF, ("kutu", (0.42, 0.12, 1.31), (0.24, 0.24, 0.3)), "fl_lo.L"),
            ("arka-ust.L", DEER_BODY, ("koni", (0.42, 3.05, -1.2), (0.42, 1.65, -1.5), 0.32, 0.16, 6), "hl_up.L"),
            ("arka-alt.L", DEER_DARK, ("koni", (0.42, 1.65, -1.5), (0.42, 0.24, -1.3), 0.13, 0.11, 5), "hl_lo.L"),
            ("arka-toynak.L", HOOF, ("kutu", (0.42, 0.12, -1.24), (0.24, 0.24, 0.3)), "hl_lo.L"),
        ]
    ),
    "shots": [("dur", 0.6), ("otla", 1.2), ("yuru", 0.3), ("yuru", 0.9), ("kos", 0.15), ("kos", 0.42), ("yigil", 2.0)],
}

# ── Tavşan ─────────────────────────────────────────────────────────
RABBIT = "#b9a58c"
RABBIT_DARK = "#8f7a62"
RABBIT_LIGHT = "#efe6d6"
SPECIES["tavsan"] = {
    "rig": mirror_rig(
        {
            "root": ((0, 0, 0), (0, 0.3, 0)),
            "body": ((0, 0.62, -0.45), (0, 0.72, 0.28)),
            "head": ((0, 0.86, 0.32), (0, 0.96, 0.78)),
            "ear.L": ((0.1, 1.12, 0.42), (0.13, 1.78, 0.36)),
            "tail": ((0, 0.7, -0.62), (0, 0.66, -0.8)),
            "fleg.L": ((0.15, 0.45, 0.3), (0.15, 0.02, 0.36)),
            "hleg.L": ((0.22, 0.55, -0.3), (0.22, 0.12, -0.42)),
            "hfoot.L": ((0.22, 0.12, -0.42), (0.22, 0.04, 0.02)),
        }
    ),
    "parents": mirror_parents(
        {
            "body": "root",
            "head": "body",
            "ear.L": "head",
            "tail": "body",
            "fleg.L": "body",
            "hleg.L": "body",
            "hfoot.L": "hleg.L",
        }
    ),
    "parts": mirror_parts(
        [
            ("govde", RABBIT, ("kutu", (0, 0.66, -0.02), (0.6, 0.56, 0.9), (-6, 0, 0)), "body"),
            ("but", RABBIT, ("kutu", (0, 0.6, -0.36), (0.72, 0.62, 0.56)), "body"),
            ("gogus", RABBIT_LIGHT, ("kutu", (0, 0.58, 0.32), (0.42, 0.36, 0.2)), "body"),
            ("bas", RABBIT, ("kutu", (0, 0.95, 0.5), (0.42, 0.42, 0.5), (8, 0, 0)), "head"),
            ("burun", "#e6a0a0", ("kutu", (0, 0.9, 0.76), (0.1, 0.08, 0.05)), "head"),
            ("goz.L", EYE, ("kutu", (0.21, 1.0, 0.58), (0.04, 0.08, 0.08)), "head"),
            ("kulak.L", RABBIT, ("kutu", (0.11, 1.45, 0.39), (0.13, 0.66, 0.06), (0, 0, -6)), "ear.L"),
            ("kulak-ic.L", "#e9b7b0", ("kutu", (0.11, 1.45, 0.42), (0.07, 0.52, 0.02), (0, 0, -6)), "ear.L"),
            ("kuyruk", RABBIT_LIGHT, ("kutu", (0, 0.72, -0.7), (0.22, 0.22, 0.2)), "tail"),
            ("on-bacak.L", RABBIT_DARK, ("kutu", (0.15, 0.24, 0.33), (0.1, 0.44, 0.12)), "fleg.L"),
            ("arka-but.L", RABBIT, ("kutu", (0.26, 0.4, -0.34), (0.16, 0.42, 0.34)), "hleg.L"),
            ("arka-ayak.L", RABBIT_DARK, ("kutu", (0.22, 0.06, -0.2), (0.15, 0.12, 0.5)), "hfoot.L"),
        ]
    ),
    "shots": [("bekle", 0.5), ("kemir", 0.4), ("zipla", 0.12), ("zipla", 0.3), ("kac", 0.08), ("kac", 0.2), ("yigil", 1.6)],
}

# ── Kuş ────────────────────────────────────────────────────────────
BIRD = "#5d6f8a"
BIRD_DARK = "#3c4a60"
BIRD_BREAST = "#d98a52"
BEAK = "#e8b13c"
SPECIES["kus"] = {
    "rig": mirror_rig(
        {
            "root": ((0, 0, 0), (0, 0.2, 0)),
            "body": ((0, 0.42, -0.26), (0, 0.46, 0.22)),
            "head": ((0, 0.56, 0.18), (0, 0.66, 0.42)),
            "wing.L": ((0.15, 0.5, 0.08), (0.78, 0.5, 0.0)),
            "tail": ((0, 0.44, -0.24), (0, 0.4, -0.66)),
            "leg.L": ((0.07, 0.3, 0.02), (0.07, 0.0, 0.04)),
        }
    ),
    "parents": mirror_parents({"body": "root", "head": "body", "wing.L": "body", "tail": "body", "leg.L": "body"}),
    "parts": mirror_parts(
        [
            ("govde", BIRD, ("kutu", (0, 0.44, -0.02), (0.32, 0.3, 0.56), (-6, 0, 0), 0.85), "body"),
            ("gogus", BIRD_BREAST, ("kutu", (0, 0.4, 0.14), (0.26, 0.22, 0.2)), "body"),
            ("bas", BIRD, ("kutu", (0, 0.64, 0.28), (0.22, 0.22, 0.24)), "head"),
            ("gaga", BEAK, ("koni", (0, 0.62, 0.39), (0, 0.6, 0.55), 0.06, 0.012, 4), "head"),
            ("goz.L", EYE, ("kutu", (0.11, 0.67, 0.33), (0.03, 0.05, 0.05)), "head"),
            ("kanat.L", BIRD_DARK, ("kutu", (0.46, 0.5, 0.02), (0.64, 0.035, 0.3), (0, 0, 0), 0.75), "wing.L"),
            ("kanat-ucu.L", "#2b3546", ("kutu", (0.72, 0.5, -0.04), (0.16, 0.03, 0.2)), "wing.L"),
            ("kuyruk", BIRD_DARK, ("kutu", (0, 0.42, -0.45), (0.2, 0.035, 0.36), (-10, 0, 0), 1.4), "tail"),
            ("bacak.L", "#c99a45", ("kutu", (0.07, 0.14, 0.03), (0.035, 0.28, 0.035)), "leg.L"),
            ("ayak.L", "#c99a45", ("kutu", (0.07, 0.01, 0.07), (0.08, 0.02, 0.12)), "leg.L"),
        ]
    ),
    "shots": [("dur", 0.5), ("gagala", 0.35), ("kanat", 0.05), ("kanat", 0.15), ("suzul", 0.6), ("suzul", 1.2), ("yigil", 1.2)],
}


# ── Klipler ────────────────────────────────────────────────────────
def smooth(a, b, k):
    k = max(0.0, min(1.0, k))
    k = k * k * (3 - 2 * k)
    return a + (b - a) * k


def blend_poses(keys, t):
    for i in range(len(keys) - 1):
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        if t0 <= t <= t1:
            k = (t - t0) / max(1e-6, t1 - t0)
            out = {}
            for name in set(p0) | set(p1):
                zero = (0, 0) if name == "root_loc" else (0, 0, 0)
                a = p0.get(name, zero)
                b = p1.get(name, zero)
                out[name] = tuple(smooth(x, y, k) for x, y in zip(a, b))
            return out
    return keys[-1][1]


S = math.sin


def deer_leg(phase, amp, lift):
    """Bir bacağın (üst, alt) açısı: phase 0–1. Öne salınımda diz bükülür."""
    a = TAU * phase
    up = -amp * S(a)  # - = öne
    swing = max(0.0, S(a + math.pi / 2))  # bacak öne giderken havada
    return up, lift * swing


def deer_clips():
    def dur(t):
        p = TAU * t / 3.2
        return {
            "chest": (1.2 * S(p), 0, 0),
            "neck": (-4 + 3 * S(p * 0.5), 0, 12 * S(p * 0.5)),
            "head": (2, 0, 6 * S(p * 0.5 + 1)),
            "tail": (8 * max(0, S(p * 3)) ** 8, 0, 0),
        }

    def otla(t):
        p = TAU * t / 2.4
        return {
            "neck": (62, 0, 4 * S(p * 0.5)),
            "head": (28 + 5 * S(p * 2), 0, 0),
            "chest": (5, 0, 0),
            "fl_up.L": (-6, 0, 0),
            "fl_up.R": (4, 0, 0),
            "tail": (6 * max(0, S(p * 2)) ** 6, 0, 0),
        }

    def yuru(t):
        c = t / 1.2
        pose = {}
        # Dört vuruşlu yürüyüş: sol arka, sol ön, sağ arka, sağ ön.
        for name, ph in (("hl_up.L", 0.0), ("fl_up.L", 0.25), ("hl_up.R", 0.5), ("fl_up.R", 0.75)):
            up, knee = deer_leg(c + ph, 20, 1)
            pose[name] = (up, 0, 0)
            lo = name.replace("_up", "_lo")
            pose[lo] = ((32 if name.startswith("fl") else -26) * knee, 0, 0)
        p = TAU * c
        pose["neck"] = (-2 + 4 * S(p * 2), 0, 0)
        pose["head"] = (-2 * S(p * 2), 0, 0)
        pose["chest"] = (0, 2 * S(p), 0)
        pose["root_loc"] = (0.05 * S(p * 2), 0)
        return pose

    def kos(t):
        c = t / 0.55
        p = TAU * c
        pose = {}
        for name, ph in (("fl_up.L", 0.0), ("fl_up.R", 0.06), ("hl_up.L", 0.5), ("hl_up.R", 0.56)):
            up, knee = deer_leg(c + ph, 42, 1)
            pose[name] = (up, 0, 0)
            pose[name.replace("_up", "_lo")] = ((55 if name.startswith("fl") else -45) * knee, 0, 0)
        pose["hips"] = (8 * S(p), 0, 0)
        pose["chest"] = (-8 * S(p), 0, 0)
        pose["neck"] = (-12 + 8 * S(p), 0, 0)
        pose["tail"] = (-30, 0, 0)
        pose["root_loc"] = (0.35 * max(0.0, S(p)), 0)
        return pose

    # Yığılma: ön dizler çöker, yana devrilir, bacaklar gevşer, baş yere düşer.
    stand = {}
    kneel = {"fl_up.L": (-50, 0, 0), "fl_lo.L": (110, 0, 0), "fl_up.R": (-50, 0, 0), "fl_lo.R": (110, 0, 0), "chest": (14, 0, 0), "neck": (20, 0, 0), "root_loc": (-0.55, 0)}
    lying = {
        "root": (0, 86, 0),
        "root_loc": (0.62, 0),
        "fl_up.L": (-28, -10, 0),
        "fl_lo.L": (40, 0, 0),
        "fl_up.R": (-18, 6, 0),
        "fl_lo.R": (30, 0, 0),
        "hl_up.L": (-14, -8, 0),
        "hl_lo.L": (-20, 0, 0),
        "hl_up.R": (-8, 6, 0),
        "hl_lo.R": (-16, 0, 0),
        "neck": (38, 0, -20),
        "head": (18, 0, 0),
        "tail": (20, 0, 0),
    }
    yigil = lambda t: blend_poses([(0, stand), (0.35, kneel), (1.0, lying), (2.2, lying)], t)
    return {"dur": (3.2, True, dur), "otla": (2.4, True, otla), "yuru": (1.2, True, yuru), "kos": (0.55, True, kos), "yigil": (2.2, False, yigil)}


def rabbit_clips():
    def bekle(t):
        p = TAU * t / 2.0
        return {
            "head": (-4 + 3 * S(p * 3) * max(0, S(p)), 0, 8 * S(p * 0.5)),
            "ear.L": (6 * max(0, S(p * 2)) ** 4, 0, 0),
            "ear.R": (-4 + 4 * S(p), 0, 0),
            "body": (1.5 * S(p * 2), 0, 0),
        }

    def kemir(t):
        p = TAU * t / 1.6
        return {"body": (14, 0, 0), "head": (24 + 6 * S(p * 4), 0, 0), "ear.L": (-20, 0, 0), "ear.R": (-20, 0, 0), "fleg.L": (-8, 0, 0), "fleg.R": (-8, 0, 0)}

    def hop(period, height, stretch):
        def pose(t):
            c = (t / period) % 1.0
            air = max(0.0, S(TAU * c * 0.5 + 0.0)) if c < 1.0 else 0
            push = S(TAU * c)
            return {
                "root_loc": (height * air, 0),
                "body": (-10 * push, 0, 0),
                "hleg.L": (stretch * max(0, push), 0, 0),
                "hleg.R": (stretch * max(0, push), 0, 0),
                "hfoot.L": (-stretch * 0.6 * max(0, push), 0, 0),
                "hfoot.R": (-stretch * 0.6 * max(0, push), 0, 0),
                "fleg.L": (-25 * air, 0, 0),
                "fleg.R": (-25 * air, 0, 0),
                "ear.L": (18 * air, 0, 0),
                "ear.R": (18 * air, 0, 0),
                "head": (-6 * air, 0, 0),
            }

        return pose

    lying = {"root": (0, 84, 0), "root_loc": (0.3, 0), "head": (10, 0, -15), "ear.L": (30, 0, 0), "ear.R": (40, 0, 0), "fleg.L": (-20, 0, 0), "hleg.L": (30, 0, 0)}
    yigil = lambda t: blend_poses([(0, {}), (0.25, {"body": (12, 0, 0), "root_loc": (-0.08, 0)}), (0.7, lying), (1.8, lying)], t)
    return {
        "bekle": (2.0, True, bekle),
        "kemir": (1.6, True, kemir),
        "zipla": (0.5, True, hop(0.5, 0.35, 40)),
        "kac": (0.32, True, hop(0.32, 0.45, 60)),
        "yigil": (1.8, False, yigil),
    }


# Kanatlar gövdenin yanına katlanır: kendi ekseninde dikleşir (x), biraz sarkar (y), geriye döner (z).
FOLD = {"wing.L": (80, 22, 84), "wing.R": (80, 22, 84)}


def bird_clips():
    def dur(t):
        p = TAU * t / 1.8
        pose = dict(FOLD)
        pose["head"] = (-6 * max(0, S(p * 2)) ** 3, 0, 22 * S(p * 0.5))
        pose["tail"] = (-6 + 6 * S(p * 2), 0, 0)
        return pose

    def gagala(t):
        p = TAU * t / 0.7
        pose = dict(FOLD)
        peck = max(0.0, S(p)) ** 2
        pose["body"] = (18 + 22 * peck, 0, 0)
        pose["head"] = (25 + 30 * peck, 0, 0)
        pose["tail"] = (-25, 0, 0)
        return pose

    def kanat(t):
        p = TAU * t / 0.3
        flap = S(p)
        return {
            "wing.L": (0, -55 * flap, 0),
            "wing.R": (0, -55 * flap, 0),
            "body": (-10, 0, 0),
            "leg.L": (60, 0, 0),
            "leg.R": (60, 0, 0),
            "tail": (-5, 0, 0),
            "root_loc": (0.04 * S(p + 1.5), 0),
        }

    def suzul(t):
        p = TAU * t / 1.8
        return {
            "wing.L": (0, -10 + 6 * S(p), 0),
            "wing.R": (0, -10 + 6 * S(p), 0),
            "body": (-4, 4 * S(p * 0.5), 0),
            "leg.L": (60, 0, 0),
            "leg.R": (60, 0, 0),
            "tail": (-8, 0, 0),
        }

    lying = {"root": (0, 82, 0), "root_loc": (0.12, 0), "wing.L": (70, 34, 70), "wing.R": (80, 14, 88), "head": (20, 0, -20), "leg.L": (40, 0, 0), "leg.R": (30, 0, 0)}
    yigil = lambda t: blend_poses([(0, dict(FOLD)), (0.5, lying), (1.4, lying)], t)
    return {"dur": (1.8, True, dur), "gagala": (0.7, True, gagala), "kanat": (0.3, True, kanat), "suzul": (1.8, True, suzul), "yigil": (1.4, False, yigil)}


CLIPS = {"geyik": deer_clips, "tavsan": rabbit_clips, "kus": bird_clips}


# ── Kurulum ────────────────────────────────────────────────────────
def hex_rgba(color):
    n = int(color[1:], 16)
    srgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], 1.0)


def material(name, color):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = 0.9
    mat.diffuse_color = hex_rgba(color)
    return mat


def shape_bmesh(shape):
    bm = bmesh.new()
    kind = shape[0]
    if kind == "kutu":
        center, size = shape[1], shape[2]
        rot = shape[3] if len(shape) > 3 else (0, 0, 0)
        taper = shape[4] if len(shape) > 4 else 1.0
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            # Daralma: arka uç (oyunda −z, Blender'da +y) "taper" katına iner, ön uç aynı kalır.
            k = 1.0 + (taper - 1.0) * (0.5 + v.co.y)
            v.co.x *= size[0] * k
            v.co.z *= size[1] * k
            v.co.y *= size[2]
        m = (
            Matrix.Translation(g2b(center))
            @ Matrix.Rotation(math.radians(rot[2]), 4, "Z")
            @ Matrix.Rotation(math.radians(-rot[0]), 4, "X")
            @ Matrix.Rotation(math.radians(rot[1]), 4, "Y")
        )
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    else:
        a, b, r1, r2 = shape[1], shape[2], shape[3], shape[4]
        seg = shape[5] if len(shape) > 5 else 6
        pa, pb = g2b(a), g2b(b)
        d = pb - pa
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d.length)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = Matrix.Translation((pa + pb) / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return bm


def seg_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length


def build_armature(rig, parents):
    data = bpy.data.armatures.new("iskelet")
    arm = bpy.data.objects.new("iskelet", data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (a, b) in rig.items():
        eb = data.edit_bones.new(name)
        eb.head = g2b(a)
        eb.tail = g2b(b)
        eb.align_roll(Vector((0, 0, 1)) if abs((eb.tail - eb.head).normalized().z) < 0.7 else Vector((0, -1, 0)))
    for name, parent in parents.items():
        if name in data.edit_bones and parent in data.edit_bones:
            data.edit_bones[name].parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def build_body(kind, spec, arm):
    rig = spec["rig"]
    objects = []
    for name, color, shape, bones in spec["parts"]:
        bm = shape_bmesh(shape)
        mesh = bpy.data.meshes.new(f"{kind}-{name}")
        bm.to_mesh(mesh)
        bm.free()
        for poly in mesh.polygons:
            poly.use_smooth = False
        obj = bpy.data.objects.new(f"{kind}-{name}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        mesh.materials.append(material(f"{kind}-{name.replace('.L', '').replace('.R', '')}", color))
        candidates = bones if isinstance(bones, list) else [bones]
        groups = {b: obj.vertex_groups.new(name=b) for b in candidates}
        segs = {b: (g2b(rig[b][0]), g2b(rig[b][1])) for b in candidates}
        for v in mesh.vertices:
            best = min(candidates, key=lambda b: seg_distance(v.co, *segs[b]))
            groups[best].add([v.index], 1.0, "REPLACE")
        objects.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "govde"
    # Aynı renkteki malzemeler zaten paylaşılıyor; çakışan köşeler parça içinde kaynaştırılır.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(body.data)
    bm.free()
    body.parent = arm
    mod = body.modifiers.new("iskelet", "ARMATURE")
    mod.object = arm
    return body


def rotation_for(pb, x, y, z):
    s = -1.0 if pb.name.endswith(".R") else 1.0
    r = Matrix.Rotation(math.radians(z * s), 3, "Z") @ Matrix.Rotation(math.radians(y * s), 3, "Y") @ Matrix.Rotation(math.radians(x), 3, "X")
    rest = pb.bone.matrix_local.to_3x3()
    return (rest.inverted() @ r @ rest).to_quaternion()


def apply_pose(arm, pose):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = rotation_for(pb, *pose.get(pb.name, (0, 0, 0)))
        pb.location = (0, 0, 0)
    up, fwd = pose.get("root_loc", (0.0, 0.0))
    root = arm.pose.bones["root"]
    rest = root.bone.matrix_local.to_3x3()
    # Kökün kaydırması iskelet uzayında (yukarı, öne) verilir.
    root.location = rest.inverted() @ Vector((0, -fwd, up))


def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if pb.name == "root":
            pb.keyframe_insert("location", frame=frame)


def bake(arm, clips):
    arm.animation_data_create()
    actions = []
    for name, (length, loop, pose) in clips.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        arm.animation_data.action = action
        frames = max(2, round(length * FPS))
        for f in list(range(0, frames, 2)) + [frames]:
            t = 0.0 if (loop and f == frames) else f / FPS
            apply_pose(arm, pose(min(t, length)))
            key_all(arm, f + 1)
        actions.append(action)
    arm.animation_data.action = None
    for action in actions:
        track = arm.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, 1, action)
        strip.name = action.name
        track.mute = True


def render_preview(arm, kind, spec, clips):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    scene.render.resolution_x = 240
    scene.render.resolution_y = 220
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    world = bpy.data.worlds.new("dunya")
    world.color = (0.12, 0.16, 0.24)
    scene.world = world
    size = {"geyik": 8.5, "tavsan": 2.6, "kus": 2.0}[kind]
    center = {"geyik": 3.2, "tavsan": 0.8, "kus": 0.45}[kind]
    cam_data = bpy.data.cameras.new("kamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size
    cam = bpy.data.objects.new("kamera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (size * 1.1, -size * 0.75, center + size * 0.45)
    cam.rotation_euler = (Vector((0, 0, center)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    tiles = []
    for clip, t in spec["shots"]:
        length, _, pose = clips[clip]
        apply_pose(arm, pose(min(t, length)))
        bpy.context.view_layer.update()
        path = os.path.join(PREVIEW_DIR, f"_{kind}-{clip}-{t}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        tiles.append(path)
    cols = len(tiles)
    w, h = scene.render.resolution_x, scene.render.resolution_y
    sheet = bpy.data.images.new("onizleme", cols * w, h, alpha=False)
    pixels = [0.0] * (cols * w * h * 4)
    for i, path in enumerate(tiles):
        img = bpy.data.images.load(path)
        src = list(img.pixels)
        for y in range(h):
            start = (y * cols * w + i * w) * 4
            pixels[start : start + w * 4] = src[y * w * 4 : (y + 1) * w * 4]
        bpy.data.images.remove(img)
        os.remove(path)
    sheet.pixels = pixels
    sheet.filepath_raw = os.path.join(PREVIEW_DIR, f"{kind}-onizleme.png")
    sheet.file_format = "PNG"
    sheet.save()
    apply_pose(arm, {})


def export_glb(arm, body, path):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = arm
    apply_pose(arm, {})
    wanted = {
        "filepath": path,
        "export_format": "GLB",
        "use_selection": True,
        "export_yup": True,
        "export_apply": False,
        "export_animations": True,
        "export_animation_mode": "NLA_TRACKS",
        "export_nla_strips": True,
        "export_force_sampling": True,
        "export_frame_step": 1,
        "export_skins": True,
        "export_all_influences": False,
        "export_morph": False,
        "export_texcoords": False,
        # Oyunda malzeme köşeli: normal gerekmez, köşeler paylaşılır.
        "export_normals": False,
        "export_materials": "EXPORT",
        "export_cameras": False,
        "export_lights": False,
    }
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    bpy.ops.export_scene.gltf(**{k: v for k, v in wanted.items() if k in props})


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for kind, spec in SPECIES.items():
        if ONLY and kind not in ONLY:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps = FPS
        arm = build_armature(spec["rig"], spec["parents"])
        body = build_body(kind, spec, arm)
        clips = CLIPS[kind]()
        bake(arm, clips)
        render_preview(arm, kind, spec, clips)
        out = os.path.join(OUT_DIR, f"hayvan-{kind}.glb")
        export_glb(arm, body, out)
        tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
        print(f"[OBA-Tales] {kind}: {len(body.data.materials)} malzeme, {tris} üçgen, {len(clips)} klip -> {out}")


main()
