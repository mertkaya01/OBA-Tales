"""
KAHRAMAN İSKELETİ VE ANİMASYONLARI — Blender'da (arka planda) çalışır: npm run blender:kahramanlar

Girdi : modeller/referans/kadro-<kimlik>.obj (+ .mtl)  — oyundaki modelin parça adlı kopyası (npm run modeller)
Çıktı : public/models/kahraman-<kimlik>.glb          — iskeletli (skinned) model ve 13 animasyon klibi
        modeller/kahramanlar/<kimlik>-onizleme.png    — kliplerden kareler (göz kontrolü için)

Yöntem
  1. OBJ içe alınır; uzak görünüm siluetleri ("-uzak-") atılır, parçalar tek ağda birleşir (malzeme adı = parça kimliği).
  2. İskelet: kök → kalça → bel → göğüs → boyun → kafa; omuz-üst kol-ön kol-el; uyluk-baldır-ayak; pelerin zinciri.
     Eklem yerleri kahramanın gövdesinden (takipçi gövdesi ya da BinTaş) ölçülmüştür.
  3. Bağlama: parça adına göre sınıf (kafa, gövde, kol, bacak, eldeki eşya, pelerin, etek); her köşe sınıfındaki en
     yakın kemik parçasına bağlanır, eklem çevresinde iki kemik arasında yumuşak geçiş (bükülünce yarık açılmasın).
  4. Klipler kodla anahtar karelerle yazılır (30 kare/sn, yerinde döngü): bosta, yuru, kos, balta, yay, topla, tasi,
     otur, sohbet, selam, esne, cadir, yika.
     Dönüşler anlamlı eksenlerle verilir: "öne salla" (pitch), "yana kaldır" (side), "kendi ekseninde çevir" (twist);
     betik bunları her kemiğin kendi eksenine çevirir.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OBJ_DIR = ARGV[0] if len(ARGV) > 0 else "modeller/referans"
OUT_DIR = ARGV[1] if len(ARGV) > 1 else "public/models"
PREVIEW_DIR = ARGV[2] if len(ARGV) > 2 else "modeller/kahramanlar"
ONLY = ARGV[3].split(",") if len(ARGV) > 3 and ARGV[3] else None

FPS = 30

# ── Kahramanlar ────────────────────────────────────────────────────
# wave: el sallayan kol (eli boş olan), tool: baltayı/kılıcı tutan kol, bow: yayı tutan kol (L = +x yanı, R = -x yanı)
HEROES = {
    "mhellingtr": {"rig": "takipci", "wave": "R", "tool": "R", "bow": "L"},
    "egetunce": {"rig": "takipci", "wave": "L", "tool": "R", "bow": "L"},
    "bintas": {"rig": "bintas", "wave": "R", "tool": "R", "bow": "L"},
}


def mirror(rig):
    """.L kemiklerinin x'i ters çevrilmiş .R eşlerini ekler."""
    out = dict(rig)
    for name, (a, b) in rig.items():
        if name.endswith(".L") and name[:-2] + ".R" not in rig:
            out[name[:-2] + ".R"] = ((-a[0], a[1], a[2]), (-b[0], b[1], b[2]))
    return out


# Eklemler oyun biriminde (x sağ-sol, y yukarı, z ön). Takipçi gövdesi: omuz (±0,55; 2,95), eller (±0,92; 1,78).
RIGS = {
    "takipci": mirror(
        {
            "root": ((0, 0, 0), (0, 0.6, 0)),
            "hips": ((0, 1.75, 0), (0, 2.1, 0)),
            "spine": ((0, 2.1, 0), (0, 2.55, 0)),
            "chest": ((0, 2.55, 0), (0, 2.95, 0)),
            "neck": ((0, 2.95, 0), (0, 3.15, 0)),
            "head": ((0, 3.15, 0), (0, 4.0, 0)),
            "upper_arm.L": ((0.55, 2.95, 0), (0.76, 2.4, 0)),
            "forearm.L": ((0.76, 2.4, 0), (0.91, 1.95, 0.02)),
            "hand.L": ((0.91, 1.95, 0.02), (0.93, 1.6, 0.05)),
            "thigh.L": ((0.3, 1.85, 0), (0.3, 1.1, 0)),
            "shin.L": ((0.3, 1.1, 0), (0.3, 0.33, 0)),
            "foot.L": ((0.3, 0.33, 0), (0.3, 0.05, 0.38)),
            "cape.1": ((0, 3.0, -0.62), (0, 1.9, -0.66)),
            "cape.2": ((0, 1.9, -0.66), (0, 0.8, -0.74)),
        }
    ),
    # BinTaş: elbiseli, beli yüksek; sağ (+x) kolu dirsekten yukarı kalkık, avucunda ateş küresi.
    "bintas": {
        "root": ((0, 0, 0), (0, 0.6, 0)),
        "hips": ((0, 1.2, 0), (0, 1.85, 0)),
        "spine": ((0, 1.85, 0), (0, 2.4, 0)),
        "chest": ((0, 2.4, 0), (0, 2.85, 0)),
        "neck": ((0, 2.85, 0), (0, 3.14, 0)),
        "head": ((0, 3.14, 0), (0, 4.0, 0)),
        "upper_arm.L": ((0.72, 2.82, 0.0), (1.0, 2.25, 0.3)),
        "forearm.L": ((1.0, 2.25, 0.3), (1.1, 2.68, 0.62)),
        "hand.L": ((1.1, 2.68, 0.62), (1.12, 2.86, 0.7)),
        "upper_arm.R": ((-0.72, 2.8, 0.0), (-0.86, 2.1, 0.08)),
        "forearm.R": ((-0.86, 2.1, 0.08), (-1.0, 1.58, 0.22)),
        "hand.R": ((-1.0, 1.58, 0.22), (-1.0, 1.33, 0.28)),
        "thigh.L": ((0.3, 1.22, 0), (0.3, 0.66, 0)),
        "shin.L": ((0.3, 0.66, 0), (0.3, 0.25, 0)),
        "foot.L": ((0.3, 0.25, 0), (0.3, 0.03, 0.35)),
        "thigh.R": ((-0.3, 1.22, 0), (-0.3, 0.66, 0)),
        "shin.R": ((-0.3, 0.66, 0), (-0.3, 0.25, 0)),
        "foot.R": ((-0.3, 0.25, 0), (-0.3, 0.03, 0.35)),
        "cape.1": ((0, 3.0, -0.78), (0, 2.6, -0.8)),
        "cape.2": ((0, 2.6, -0.8), (0, 2.1, -0.82)),
    },
}

PARENTS = {
    "hips": "root",
    "spine": "hips",
    "chest": "spine",
    "neck": "chest",
    "head": "neck",
    "upper_arm.L": "chest",
    "forearm.L": "upper_arm.L",
    "hand.L": "forearm.L",
    "upper_arm.R": "chest",
    "forearm.R": "upper_arm.R",
    "hand.R": "forearm.R",
    "thigh.L": "hips",
    "shin.L": "thigh.L",
    "foot.L": "shin.L",
    "thigh.R": "hips",
    "shin.R": "thigh.R",
    "foot.R": "shin.R",
    "cape.1": "chest",
    "cape.2": "cape.1",
}


def g2b(p):
    """Oyun (x, y yukarı, z ön) → Blender (x, -z, y). OBJ içe alımı da aynı dönüşümü yapar."""
    return Vector((p[0], -p[2], p[1]))


def b2g(v):
    return (v.x, v.z, -v.y)


# ── Parça sınıfları ────────────────────────────────────────────────

def part_class(name):
    n = name
    for prefix in ("okyeli-", "kalkaneri-", "ocakcan-", "bintas-", "mhellingtr-", "egetunce-", "buyucu-"):
        if n.startswith(prefix):
            n = n[len(prefix) :]
            break
    def has(*keys):
        return any(k in n for k in keys)

    if has("uzak-"):
        return "skip"
    if has("uzun-pelerin", "pelerin-yildiz", "takimyildiz"):
        return "cape"
    if has("kilic", "lavanta", "yay", "kalkan", "asa", "alev-kuresi", "kure-cekirdegi", "kor-parcalari", "fener", "kopuz"):
        return "held"
    if has("kafa", "sac", "goz", "kaslar", "burun", "agiz", "dudak", "kulak", "kupe", "sakal", "biyik", "sapka", "kapuson",
           "tolga", "hale", "tac", "kahkul", "alev-uclari"):
        return "head"
    if has("boyun"):
        return "neck"
    if has("sadak", "oklar", "ok-tuyu", "ok-kristal", "kanat", "omuz"):
        return "chest"
    if has("kollar", "eller", "bilek", "bilezik", "kol-"):
        return "arm"
    if has("bacak", "cizme"):
        return "leg"
    if has("etek", "alev-dilleri", "tabard"):
        return "hips"
    return "torso"


def seg_distance(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length


BLEND = 0.12  # eklemde iki kemik arasındaki geçiş genişliği (dünya birimi)


def weights_for(p_game, cls, rig, side, held_side):
    """Köşenin (oyun koordinatı) kemik ağırlıkları: [(kemik, ağırlık)]."""
    p = Vector(p_game)

    def seg(name):
        a, b = rig[name]
        return seg_distance(p, Vector(a), Vector(b))

    if cls == "head":
        names = ["head", "neck"]
    elif cls == "neck":
        names = ["neck", "head", "chest"]
    elif cls == "torso":
        names = ["hips", "spine", "chest"]
    elif cls == "hips":
        return [("hips", 1.0)]
    elif cls == "chest":
        return [("chest", 1.0)]
    elif cls == "cape":
        names = ["cape.1", "cape.2"]
    elif cls == "held":
        return [("hand." + held_side, 1.0)]
    elif cls == "arm":
        names = ["upper_arm." + side, "forearm." + side, "hand." + side, "chest"]
    elif cls == "leg":
        names = ["thigh." + side, "shin." + side, "foot." + side, "hips"]
    else:
        names = ["spine"]
    ranked = sorted(((seg(n), n) for n in names if n in rig))
    (d1, n1) = ranked[0]
    if len(ranked) > 1:
        (d2, n2) = ranked[1]
        # Yalnızca birbirine bağlı kemikler arasında geçiş (dirsek, diz, omuz, kalça, boyun).
        linked = PARENTS.get(n1) == n2 or PARENTS.get(n2) == n1
        if linked and d2 - d1 < BLEND:
            w1 = 0.5 + 0.5 * (d2 - d1) / BLEND
            return [(n1, w1), (n2, 1.0 - w1)]
    return [(n1, 1.0)]


# ── Sahne kurulumu ─────────────────────────────────────────────────

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_hero(path):
    bpy.ops.wm.obj_import(filepath=path, forward_axis="NEGATIVE_Z", up_axis="Y")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    keep = []
    for o in meshes:
        if part_class(o.name) == "skip":
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            keep.append(o)
    # OBJ indekssiz gelir (her üçgenin kendi köşeleri). Parça içinde çakışan köşeler kaynaştırılır: oyunda malzeme
    # zaten köşeli (flatShading), dosya küçülür. Yüzler düz kalır ki önizleme de köşeli görünsün.
    for o in keep:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(o.data)
        bm.free()
        for p in o.data.polygons:
            p.use_smooth = False
    return keep


def build_armature(rig):
    data = bpy.data.armatures.new("iskelet")
    arm = bpy.data.objects.new("iskelet", data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (a, b) in rig.items():
        eb = data.edit_bones.new(name)
        eb.head = g2b(a)
        eb.tail = g2b(b)
        # Yerel Z ekseni öne (Blender -Y) baksın; ayakta yukarı.
        eb.align_roll(Vector((0, 0, 1)) if name.startswith("foot") else Vector((0, -1, 0)))
    for name, parent in PARENTS.items():
        if name in data.edit_bones and parent in data.edit_bones:
            data.edit_bones[name].parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def bind(meshes, arm, rig, hero):
    for o in meshes:
        cls = part_class(o.name)
        # Eldeki eşyanın yanı: parçanın ortalama x'i.
        mean_x = sum((o.matrix_world @ v.co).x for v in o.data.vertices) / max(1, len(o.data.vertices))
        held_side = "L" if mean_x >= 0 else "R"
        groups = {}
        for v in o.data.vertices:
            g = b2g(o.matrix_world @ v.co)
            side = "L" if g[0] >= 0 else "R"
            for bone, w in weights_for(g, cls, rig, side, held_side):
                if bone not in groups:
                    groups[bone] = o.vertex_groups.new(name=bone)
                groups[bone].add([v.index], w, "REPLACE")
    # Tek ağ: malzemeler (parça kimlikleri) korunur.
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "govde"
    body.data.name = "govde"
    for poly in body.data.polygons:
        poly.use_smooth = False
    mod = body.modifiers.new("iskelet", "ARMATURE")
    mod.object = arm
    body.parent = arm
    return body


# ── Poz yardımcıları ───────────────────────────────────────────────

FORWARD = Vector((0, -1, 0))


def pose_rotation(pb, pitch=0.0, side=0.0, twist=0.0):
    """Anlamlı eksenler (derece) → kemiğin yerel dönüşü.
    pitch: kemiğin ucu öne gider · side: uç kendi yanına (dışa) kalkar · twist: kemik kendi ekseninde döner."""
    rest = pb.bone.matrix_local.to_3x3()
    d = (rest @ Vector((0, 1, 0))).normalized()
    s = 1.0 if pb.name.endswith(".L") else (-1.0 if pb.name.endswith(".R") else 1.0)
    axis_p = d.cross(FORWARD)
    if axis_p.length < 1e-4:
        axis_p = Vector((1, 0, 0))
    axis_s = d.cross(Vector((s, 0, 0)))
    if axis_s.length < 1e-4:
        axis_s = Vector((0, -1, 0))
    r = Matrix.Rotation(math.radians(pitch), 3, axis_p.normalized())
    r = r @ Matrix.Rotation(math.radians(side), 3, axis_s.normalized())
    r = r @ Matrix.Rotation(math.radians(twist), 3, d)
    return (rest.inverted() @ r @ rest).to_quaternion()


def apply_pose(arm, pose):
    """pose: {kemik: (pitch, side, twist)} ve isteğe bağlı "root": (yukarı, öne)."""
    pose = dict(pose)
    # Pelerin yerçekimiyle sarkar: gövde öne eğilince (bel + göğüs) pelerin aynı açıyla geri döner, sırttan tahta gibi
    # kalkmaz. Klipteki pelerin açısı (yürürken arkada uçuşması) bunun üstüne eklenir.
    lean = pose.get("spine", (0, 0, 0))[0] + pose.get("chest", (0, 0, 0))[0] + pose.get("hips", (0, 0, 0))[0]
    cape = pose.get("cape.1", (0, 0, 0))
    pose["cape.1"] = (cape[0] + lean, cape[1], cape[2])
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        p = pose.get(pb.name, (0, 0, 0))
        pb.rotation_quaternion = pose_rotation(pb, *p)
        pb.location = (0, 0, 0)
    up, fwd = pose.get("root_loc", (0.0, 0.0))
    root = arm.pose.bones["root"]
    # Kökün yerel Y'si yukarı, yerel Z'si öne.
    root.location = (0, up, fwd)


def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if pb.name == "root":
            pb.keyframe_insert("location", frame=frame)


# ── Klipler ────────────────────────────────────────────────────────
# Her klip: (süre sn, döngü mü, poz(t) → dict). Pozlar kahramanın kollarına göre (wave/tool/bow) kurulur.

def smooth(a, b, k):
    k = max(0.0, min(1.0, k))
    k = k * k * (3 - 2 * k)
    return a + (b - a) * k


def blend_poses(keys, t):
    """keys: [(zaman, poz)] — aradaki poz yumuşak geçişle."""
    for i in range(len(keys) - 1):
        t0, p0 = keys[i]
        t1, p1 = keys[i + 1]
        if t0 <= t <= t1:
            k = (t - t0) / max(1e-6, t1 - t0)
            out = {}
            for name in set(p0) | set(p1):
                a = p0.get(name, (0, 0, 0) if name != "root_loc" else (0, 0))
                b = p1.get(name, (0, 0, 0) if name != "root_loc" else (0, 0))
                out[name] = tuple(smooth(x, y, k) for x, y in zip(a, b))
            return out
    return keys[-1][1]


def other(side):
    return "R" if side == "L" else "L"


def walk_legs(phi, amp=24.0, knee=32.0, center=0.0):
    pose = {}
    for side, off in (("L", 0.0), ("R", math.pi)):
        ph = phi + off
        pose["thigh." + side] = (center + amp * math.sin(ph), 0, 0)
        pose["shin." + side] = (-(5 + knee * max(0.0, math.cos(ph))), 0, 0)
        pose["foot." + side] = (8 * max(0.0, math.sin(ph)) - 6 * max(0.0, -math.sin(ph)), 0, 0)
    return pose


def clip_bosta(hero):
    def pose(t):
        phi = 2 * math.pi * t / 2.4
        return {
            "chest": (1.5 * math.sin(phi), 0, 0),
            "upper_arm.L": (2 * math.sin(phi), 3, 0),
            "upper_arm.R": (2 * math.sin(phi + 0.6), 3, 0),
            "forearm.L": (6, 0, 0),
            "forearm.R": (6, 0, 0),
            "head": (0, 0, 5 * math.sin(phi)),
            "root_loc": (0.008 * math.sin(2 * phi), 0),
        }
    return 2.4, True, pose


def clip_yuru(hero):
    def pose(t):
        phi = 2 * math.pi * t / 1.0
        p = walk_legs(phi)
        p.update({
            "upper_arm.L": (-18 * math.sin(phi), 4, 0),
            "upper_arm.R": (-18 * math.sin(phi + math.pi), 4, 0),
            "forearm.L": (12 + 10 * max(0.0, -math.sin(phi)), 0, 0),
            "forearm.R": (12 + 10 * max(0.0, math.sin(phi)), 0, 0),
            "hips": (0, 2.5 * math.sin(phi), 5 * math.sin(phi)),
            "spine": (3, 0, 0),
            "chest": (0, 0, -7 * math.sin(phi)),
            "head": (0, 0, 3 * math.sin(phi)),
            "cape.1": (-6 - 3 * math.cos(2 * phi), 0, 0),
            "cape.2": (-4 - 4 * math.cos(2 * phi + 0.6), 0, 0),
            "root_loc": (0.035 * math.cos(2 * phi), 0),
        })
        return p
    return 1.0, True, pose


def clip_kos(hero):
    def pose(t):
        phi = 2 * math.pi * t / 0.62
        p = walk_legs(phi, amp=40, knee=80, center=15)
        p.update({
            "upper_arm.L": (10 - 35 * math.sin(phi), 6, 0),
            "upper_arm.R": (10 - 35 * math.sin(phi + math.pi), 6, 0),
            "forearm.L": (75, 0, 0),
            "forearm.R": (75, 0, 0),
            "hips": (0, 2, 7 * math.sin(phi)),
            "spine": (12, 0, 0),
            "chest": (2, 0, -10 * math.sin(phi)),
            "head": (-8, 0, 4 * math.sin(phi)),
            "cape.1": (-25 - 6 * math.cos(2 * phi), 0, 0),
            "cape.2": (-15 - 8 * math.cos(2 * phi + 0.6), 0, 0),
            "root_loc": (0.07 * math.cos(2 * phi) - 0.03, 0),
        })
        return p
    return 0.62, True, pose


def clip_balta(hero):
    ready = {"upper_arm.L": (50, -10, 0), "upper_arm.R": (50, -10, 0), "forearm.L": (40, 0, 0), "forearm.R": (40, 0, 0), "spine": (5, 0, 0),
             "thigh.L": (8, 0, 0), "thigh.R": (-6, 0, 0), "shin.L": (-10, 0, 0), "shin.R": (-6, 0, 0)}
    windup = {"upper_arm.L": (170, 8, 0), "upper_arm.R": (170, 8, 0), "forearm.L": (35, 0, 0), "forearm.R": (35, 0, 0),
              "spine": (-8, 0, 0), "chest": (-8, 0, 0), "head": (-6, 0, 0), "thigh.L": (8, 0, 0), "thigh.R": (-6, 0, 0),
              "shin.L": (-8, 0, 0), "shin.R": (-6, 0, 0), "root_loc": (0.03, 0)}
    impact = {"upper_arm.L": (70, -12, 0), "upper_arm.R": (70, -12, 0), "forearm.L": (12, 0, 0), "forearm.R": (12, 0, 0),
              "spine": (24, 0, 0), "chest": (10, 0, 0), "head": (8, 0, 0), "thigh.L": (18, 0, 0), "thigh.R": (-4, 0, 0),
              "shin.L": (-26, 0, 0), "shin.R": (-18, 0, 0), "root_loc": (-0.09, 0)}
    follow = {**impact, "upper_arm.L": (55, -12, 0), "upper_arm.R": (55, -12, 0), "forearm.L": (25, 0, 0), "forearm.R": (25, 0, 0), "spine": (18, 0, 0)}
    keys = [(0.0, ready), (0.45, windup), (0.62, impact), (0.8, follow), (1.3, ready)]
    return 1.3, True, lambda t: blend_poses(keys, t)


def clip_yay(hero):
    bow, draw = hero["bow"], other(hero["bow"])
    turn = 25 if bow == "L" else -25
    rest = {"upper_arm." + bow: (10, 4, 0), "upper_arm." + draw: (10, 4, 0), "forearm." + bow: (8, 0, 0), "forearm." + draw: (8, 0, 0)}
    # Kol öne kalkınca yay dik kalsın: bilek kolun kalkışı kadar geri döner.
    raise_ = {"upper_arm." + bow: (85, 6, 0), "forearm." + bow: (4, 0, 0), "hand." + bow: (-86, 0, 0), "upper_arm." + draw: (82, -14, 0), "forearm." + draw: (30, 0, 0),
              "chest": (0, 0, turn), "head": (0, 0, -turn * 0.8), "thigh.L": (6, 0, 0), "thigh.R": (-6, 0, 0)}
    drawn = {**raise_, "upper_arm." + draw: (84, 22, 0), "forearm." + draw: (138, 0, 0), "chest": (0, 0, turn * 1.2), "head": (0, 0, -turn)}
    hold = {**drawn, "upper_arm." + bow: (86, 6, 0)}
    release = {**drawn, "upper_arm." + draw: (80, 40, 0), "forearm." + draw: (100, 0, 0), "upper_arm." + bow: (80, 6, 0)}
    keys = [(0.0, rest), (0.5, raise_), (1.1, drawn), (1.6, hold), (1.72, release), (2.0, release), (2.4, rest)]
    return 2.4, True, lambda t: blend_poses(keys, t)


CROUCH = {"thigh.L": (75, 4, 0), "thigh.R": (70, 4, 0), "shin.L": (-112, 0, 0), "shin.R": (-108, 0, 0), "foot.L": (36, 0, 0), "foot.R": (34, 0, 0),
          "spine": (30, 0, 0), "chest": (14, 0, 0), "neck": (8, 0, 0), "root_loc": (-0.55, 0.05)}


def clip_topla(hero):
    hand = hero["wave"]
    rest_hand = other(hand)
    reach = {**CROUCH, "upper_arm." + hand: (58, -6, 0), "forearm." + hand: (10, 0, 0), "upper_arm." + rest_hand: (35, 4, 0), "forearm." + rest_hand: (40, 0, 0)}
    pick = {**reach, "forearm." + hand: (28, 0, 0), "hand." + hand: (20, 0, 0)}
    lift = {**reach, "upper_arm." + hand: (42, -4, 0), "forearm." + hand: (105, 0, 0)}
    keys = [(0.0, reach), (0.6, pick), (0.9, reach), (1.2, pick), (1.6, lift), (2.2, reach)]
    return 2.2, True, lambda t: blend_poses(keys, t)


def clip_tasi(hero):
    def pose(t):
        phi = 2 * math.pi * t / 1.1
        p = walk_legs(phi, amp=20, knee=26)
        p.update({
            "upper_arm.L": (28, 18, 0),
            "upper_arm.R": (28, 18, 0),
            "forearm.L": (120, 0, 0),
            "forearm.R": (120, 0, 0),
            "spine": (8, 0, 0),
            "chest": (0, 0, -4 * math.sin(phi)),
            "head": (4, 0, 2 * math.sin(phi)),
            "root_loc": (0.03 * math.cos(2 * phi) - 0.02, 0),
        })
        return p
    return 1.1, True, pose


SIT = {"thigh.L": (88, 6, 0), "thigh.R": (88, 6, 0), "shin.L": (-90, 0, 0), "shin.R": (-90, 0, 0), "spine": (6, 0, 0),
       "upper_arm.L": (32, 0, 0), "upper_arm.R": (32, 0, 0), "forearm.L": (38, 0, 0), "forearm.R": (38, 0, 0), "root_loc": (-0.75, 0.0)}


def clip_otur(hero):
    def pose(t):
        phi = 2 * math.pi * t / 3.0
        p = dict(SIT)
        p["chest"] = (2 * math.sin(phi), 0, 0)
        p["head"] = (2, 0, 6 * math.sin(phi))
        return p
    return 3.0, True, pose


def clip_sohbet(hero):
    hand = hero["wave"]
    def pose(t):
        phi = 2 * math.pi * t / 3.0
        p = dict(SIT)
        p["upper_arm." + hand] = (45 + 10 * math.sin(2 * phi), -10, 0)
        p["forearm." + hand] = (70 + 25 * math.sin(2 * phi), 0, 15 * math.sin(phi))
        p["chest"] = (3, 0, 8 * math.sin(phi))
        p["head"] = (4 + 4 * math.sin(2 * phi), 6 * math.sin(phi), 0)
        return p
    return 3.0, True, pose


def clip_selam(hero):
    hand = hero["wave"]
    def pose(t):
        phi = 2 * math.pi * t / 1.8
        return {
            "upper_arm." + hand: (12, 158, 0),
            "forearm." + hand: (14, 25 * math.sin(2 * phi), 0),
            "hand." + hand: (0, 10 * math.sin(2 * phi), 0),
            "upper_arm." + other(hand): (4, 4, 0),
            "forearm." + other(hand): (8, 0, 0),
            "head": (0, 7 if hand == "L" else -7, 0),
            "chest": (0, -3 if hand == "L" else 3, 0),
            "root_loc": (0.01 * math.sin(2 * phi), 0),
        }
    return 1.8, True, pose


def clip_esne(hero):
    rest = {}
    up = {"upper_arm.L": (168, 14, 0), "upper_arm.R": (168, 14, 0), "forearm.L": (20, 0, 0), "forearm.R": (20, 0, 0),
          "spine": (-6, 0, 0), "chest": (-12, 0, 0), "head": (-16, 0, 0), "root_loc": (0.04, 0)}
    keys = [(0.0, rest), (1.0, up), (2.0, up), (3.0, rest)]
    return 3.0, False, lambda t: blend_poses(keys, t)


def clip_cadir(hero):
    def pose(t):
        phi = 2 * math.pi * t / 1.6
        p = {
            "thigh.L": (45 + 12 * math.sin(phi), 0, 0),
            "thigh.R": (45 - 12 * math.sin(phi), 0, 0),
            "shin.L": (-72, 0, 0),
            "shin.R": (-72, 0, 0),
            "foot.L": (25, 0, 0),
            "foot.R": (25, 0, 0),
            "spine": (42, 0, 0),
            "chest": (10, 0, 0),
            "head": (-14, 0, 0),
            "upper_arm.L": (30, 6, 0),
            "upper_arm.R": (30, 6, 0),
            "forearm.L": (30, 0, 0),
            "forearm.R": (30, 0, 0),
            "root_loc": (-0.45, 0.0),
        }
        return p
    return 1.6, True, pose


def clip_yika(hero):
    down = {**CROUCH, "upper_arm.L": (70, -8, 0), "upper_arm.R": (70, -8, 0), "forearm.L": (14, 0, 0), "forearm.R": (14, 0, 0), "head": (16, 0, 0)}
    cup = {**down, "hand.L": (25, 0, 0), "hand.R": (25, 0, 0)}
    face = {**CROUCH, "upper_arm.L": (44, -14, 0), "upper_arm.R": (44, -14, 0), "forearm.L": (128, 0, 0), "forearm.R": (128, 0, 0), "head": (22, 0, 0)}
    keys = [(0.0, down), (0.8, cup), (1.3, face), (1.9, face), (2.6, down)]
    return 2.6, True, lambda t: blend_poses(keys, t)


CLIPS = {
    "bosta": clip_bosta,
    "yuru": clip_yuru,
    "kos": clip_kos,
    "balta": clip_balta,
    "yay": clip_yay,
    "topla": clip_topla,
    "tasi": clip_tasi,
    "otur": clip_otur,
    "sohbet": clip_sohbet,
    "selam": clip_selam,
    "esne": clip_esne,
    "cadir": clip_cadir,
    "yika": clip_yika,
}


def bake_clips(arm, hero):
    arm.animation_data_create()
    actions = []
    for name, build in CLIPS.items():
        length, loop, pose = build(hero)
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        arm.animation_data.action = action
        frames = max(2, round(length * FPS))
        step = 2
        for f in list(range(0, frames, step)) + [frames]:
            t = f / FPS
            if loop and f == frames:
                t = 0.0  # döngü: son kare ilk kareyle aynı
            apply_pose(arm, pose(min(t, length)))
            key_all(arm, f + 1)
        actions.append(action)
    arm.animation_data.action = None
    # Dışa aktarımda her klip ayrı animasyon olsun diye her biri kendi NLA izinde.
    for action in actions:
        track = arm.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, 1, action)
        strip.name = action.name
        track.mute = True
    return actions


# ── Önizleme ───────────────────────────────────────────────────────

PREVIEW_SHOTS = [("bosta", 0.0), ("yuru", 0.25), ("kos", 0.15), ("balta", 0.45), ("balta", 0.62), ("yay", 1.3), ("topla", 0.6),
                 ("tasi", 0.3), ("otur", 0.0), ("sohbet", 0.5), ("selam", 0.45), ("esne", 1.5), ("cadir", 0.4), ("yika", 1.5)]


def render_preview(arm, body, hero_id, hero):
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    scene.render.resolution_x = 260
    scene.render.resolution_y = 300
    scene.render.film_transparent = False
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    world = bpy.data.worlds.new("dunya")
    world.color = (0.12, 0.16, 0.24)
    scene.world = world
    cam_data = bpy.data.cameras.new("kamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 6.4
    cam = bpy.data.objects.new("kamera", cam_data)
    scene.collection.objects.link(cam)
    # Önden-çapraz, hafif yukarıdan (oyun z önde → Blender -Y).
    cam.location = (4.5, -9.0, 4.2)
    direction = Vector((0, 0, 2.2)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    tiles = []
    for clip, t in PREVIEW_SHOTS:
        length, loop, pose = CLIPS[clip](hero)
        apply_pose(arm, pose(min(t, length)))
        bpy.context.view_layer.update()
        path = os.path.join(PREVIEW_DIR, f"_{hero_id}-{clip}-{t}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        tiles.append(path)
    # Kareleri tek resimde birleştir (7 × 2).
    cols, rows = 7, 2
    w, h = scene.render.resolution_x, scene.render.resolution_y
    sheet = bpy.data.images.new("onizleme", cols * w, rows * h, alpha=False)
    pixels = [0.0] * (cols * w * rows * h * 4)
    for i, path in enumerate(tiles):
        img = bpy.data.images.load(path)
        src = list(img.pixels)
        cx, cy = i % cols, rows - 1 - i // cols
        for y in range(h):
            row = src[y * w * 4 : (y + 1) * w * 4]
            start = ((cy * h + y) * cols * w + cx * w) * 4
            pixels[start : start + w * 4] = row
        bpy.data.images.remove(img)
        os.remove(path)
    sheet.pixels = pixels
    sheet.filepath_raw = os.path.join(PREVIEW_DIR, f"{hero_id}-onizleme.png")
    sheet.file_format = "PNG"
    sheet.save()
    apply_pose(arm, {})


# ── Dışa aktarım ───────────────────────────────────────────────────

def export_glb(arm, body, path):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = arm
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
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
        # Oyunda malzeme köşeli (flatShading): yüz normali gölgelendiricide hesaplanır. Normal yazılmayınca köşeler
        # üçgenler arasında paylaşılır, dosya yarıdan fazla küçülür.
        "export_normals": False,
        "export_materials": "EXPORT",
        "export_cameras": False,
        "export_lights": False,
    }
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kwargs = {k: v for k, v in wanted.items() if k in props}
    bpy.ops.export_scene.gltf(**kwargs)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for hero_id, hero in HEROES.items():
        if ONLY and hero_id not in ONLY:
            continue
        clear_scene()
        bpy.context.scene.render.fps = FPS
        path = os.path.join(OBJ_DIR, f"kadro-{hero_id}.obj")
        meshes = import_hero(path)
        rig = RIGS[hero["rig"]]
        arm = build_armature(rig)
        body = bind(meshes, arm, rig, hero)
        bake_clips(arm, hero)
        render_preview(arm, body, hero_id, hero)
        out = os.path.join(OUT_DIR, f"kahraman-{hero_id}.glb")
        export_glb(arm, body, out)
        tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
        print(f"[OBA-Tales] {hero_id}: {len(body.data.materials)} parça, {tris} üçgen, {len(CLIPS)} klip -> {out}")


main()
