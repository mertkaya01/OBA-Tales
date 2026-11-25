"""OBA-Tales karakter kiti: modeller/kit.json -> Blender dosyası (.blend)

Proje kökünden:  npm run blender:kit
Doğrudan:        blender --background --factory-startup --python-exit-code 1 \
                   --python scripts/blender/kit_olustur.py -- modeller/kit.json modeller/OBA-Tales-karakter-kit.blend [onizleme.png]

Kurulan dosya:
  COL_KIT            oyuna giden bütün parçalar, gruplara ayrılmış (COL_01_Govde, COL_02_Yuz ...).
                     Nesnenin adı ve "oba_parca" özelliği oyundaki parça kimliğidir (kafa, kalkan, yay ...).
                     Açılışta tolgalı, kılıçlı bir Kalkaneri görünür; öteki seçenekler (börk, yay, kopuz ...)
                     gizlidir, Outliner'daki göz simgesiyle açılır. Gizli olanlar da oyuna aktarılır.
  COL_REFERANS       omuz ve kalça eklemleri, ön yönü, kamera, ışık. Oyuna gitmez.
  Metin düzenleyici  "OBA-Tales_oyuna_aktar.py" (Alt+P ile oyuna aktarır) ve "OKU_BENI".

Eksen: oyunda y yukarı, karakter +z'ye bakar. Blender'da z yukarı, karakter -Y'ye bakar (Front görünümü,
Numpad 1, karakterin yüzünü gösterir). glTF dışa aktarımı (+Y Up) eksenleri oyuna geri çevirir.
Ölçü: 1 Blender metresi = 1 oyun birimi; karakter ~4,4 m boyundadır.
"""

import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("Kullanım: ... --python kit_olustur.py -- kit.json cikti.blend [onizleme.png]")
KIT_JSON = os.path.abspath(argv[0])
BLEND_OUT = os.path.abspath(argv[1])
PREVIEW_OUT = os.path.abspath(argv[2]) if len(argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))

# Oyunun kol ve bacak eklemleri (src/world3d/characters/characterMaterials.ts), Blender koordinatında.
SHOULDER = (0.82, 0.0, 2.62)
HIP = (0.0, 0.0, 1.0)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_color):
    h = hex_color.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def make_material(part_id, hex_color):
    rgba = hex_to_linear(hex_color)
    mat = bpy.data.materials.new(f"M_{part_id}")
    mat.diffuse_color = rgba  # Solid görünümde (Viewport Display) renk
    mat.roughness = 1.0
    mat.metallic = 0.0
    if mat.node_tree is None:
        try:
            mat.use_nodes = True  # Blender 5'ten önceki sürümler için
        except AttributeError:
            pass
    if mat.node_tree is not None:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is not None:
            bsdf.inputs["Base Color"].default_value = rgba
            bsdf.inputs["Roughness"].default_value = 1.0
    return mat


def make_mesh(part):
    p = part["positions"]
    # Oyun (x, y yukarı, z ön) -> Blender (x, -z, y): dönme matrisi, yüz yönleri korunur.
    verts = [(p[i], -p[i + 2], p[i + 1]) for i in range(0, len(p), 3)]
    faces = [(i, i + 1, i + 2) for i in range(0, len(verts), 3)]
    mesh = bpy.data.meshes.new(part["id"])
    mesh.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    # Aynı düzlemdeki üçgen çiftleri dörtgen olur: düzenlemesi kolaylaşır, görünüm aynı kalır.
    try:
        bmesh.ops.join_triangles(
            bm,
            faces=bm.faces[:],
            angle_face_threshold=math.radians(0.5),
            angle_shape_threshold=math.radians(180.0),
        )
    except (TypeError, ValueError):
        pass
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = False  # oyundaki gibi düz gölgeli (flat)
    mesh.validate()
    mesh.update()
    return mesh


def link_text(name, body):
    text = bpy.data.texts.get(name) or bpy.data.texts.new(name)
    text.clear()
    text.write(body)
    return text


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_empty(name, location, collection, size=0.35, kind="PLAIN_AXES"):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = kind
    empty.empty_display_size = size
    empty.location = location
    collection.objects.link(empty)
    return empty


def main():
    with open(KIT_JSON, encoding="utf-8") as f:
        kit = json.load(f)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "OBA-Tales"
    scene.unit_settings.system = "METRIC"
    scene["oba_kit_surumu"] = kit.get("version", 1)

    root = bpy.data.collections.new("COL_KIT")
    scene.collection.children.link(root)
    groups = {}
    hidden = []
    top = 0.0
    for part in kit["parts"]:
        group = part["group"]
        if group not in groups:
            col = bpy.data.collections.new("COL_" + group.replace(" ", "_"))
            root.children.link(col)
            groups[group] = col
        mesh = make_mesh(part)
        mesh.materials.append(make_material(part["id"], part["color"]))
        obj = bpy.data.objects.new(part["id"], mesh)
        obj["oba_parca"] = part["id"]
        groups[group].objects.link(obj)
        if part["visible"]:
            top = max(top, max(v.co.z for v in mesh.vertices))
        else:
            hidden.append(obj)

    for obj in hidden:
        obj.hide_set(True)
        obj.hide_render = True

    # Yardımcılar: eklemler, ön yönü, boy, kamera ve ışık. Oyuna gitmez.
    ref = bpy.data.collections.new("COL_REFERANS")
    scene.collection.children.link(ref)
    make_empty("OMUZ_+X (kollar buradan doner)", SHOULDER, ref)
    make_empty("OMUZ_-X (kollar buradan doner)", (-SHOULDER[0], SHOULDER[1], SHOULDER[2]), ref)
    make_empty("KALCA (bacaklar buradan doner)", HIP, ref, size=0.5)
    make_empty(f"BOY_{top:.2f}m", (0.0, 0.0, top), ref, size=0.6, kind="SINGLE_ARROW").rotation_euler = (math.pi, 0, 0)
    front = make_empty("ON_YUZ (-Y)", (0.0, -1.2, 0.02), ref, size=1.0, kind="SINGLE_ARROW")
    front.rotation_euler = (math.radians(90), 0, 0)
    text_curve = bpy.data.curves.new("ON_yazi", "FONT")
    text_curve.body = "ON"
    text_curve.size = 0.45
    text_curve.align_x = "CENTER"
    label = bpy.data.objects.new("ON_yazi", text_curve)
    label.location = (0.0, -2.6, 0.02)
    ref.objects.link(label)

    cam_data = bpy.data.cameras.new("Kamera")
    cam_data.lens = 70
    cam = bpy.data.objects.new("Kamera", cam_data)
    cam.location = (6.8, -11.5, 4.6)
    ref.objects.link(cam)
    look_at(cam, (0.0, 0.0, top * 0.5))
    scene.camera = cam
    sun_data = bpy.data.lights.new("Gunes", "SUN")
    sun_data.energy = 3.0
    sun = bpy.data.objects.new("Gunes", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    ref.objects.link(sun)
    for obj in ref.objects:
        obj.hide_render = obj.type not in {"CAMERA", "LIGHT"}

    world = bpy.data.worlds.new("Gok")
    world.color = (0.32, 0.4, 0.47)
    scene.world = world

    # Önizleme: Workbench, malzeme renkleri, düz gölge.
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_object_outline = True
    shading.show_shadows = True
    scene.render.resolution_x = 720
    scene.render.resolution_y = 880
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False

    # Dosya açıldığında görünüm: Solid, malzeme renkleri, karakter önden-çapraz.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != "VIEW_3D":
                continue
            for space in area.spaces:
                if space.type != "VIEW_3D":
                    continue
                space.shading.type = "SOLID"
                space.shading.color_type = "MATERIAL"
                space.shading.show_object_outline = True
                space.clip_start = 0.01
                r3d = space.region_3d
                if r3d is not None:
                    r3d.view_perspective = "PERSP"
                    r3d.view_location = (0.0, 0.0, top * 0.5)
                    r3d.view_distance = 11.0
                    r3d.view_rotation = Euler((math.radians(78), 0.0, math.radians(28)), "XYZ").to_quaternion()

    with open(os.path.join(HERE, "oyuna_aktar.py"), encoding="utf-8") as f:
        link_text("OBA-Tales_oyuna_aktar.py", f.read())
    link_text(
        "OKU_BENI",
        "OBA-Tales karakter kiti\n"
        "=======================\n\n"
        "1. COL_KIT icindeki parcalari duzenle. Nesne adlarini (ve 'oba_parca' ozelligini) degistirme:\n"
        "   oyun parcayi bu addan tanir ve her takipcinin rengini ona verir.\n"
        "2. Gizli parcalar (bork, yay, kopuz ...) Outliner'daki goz simgesiyle acilir. Hepsi oyuna gider.\n"
        "3. Karakter -Y'ye bakar (Numpad 1 = on). Ayak tabani z = 0, boy ~4,4 m.\n"
        "4. Kollar OMUZ noktalarindan, bacaklar KALCA'dan doner: sag-sol parcalari x = 0'in kendi tarafinda tut.\n"
        "5. Dusuk poligon: bir karakter toplam ~1500 ucgeni gecmesin, Shade Flat kullan.\n"
        "6. Bitince: bu dosyayi kaydet (Ctrl+S), 'OBA-Tales_oyuna_aktar.py' metnini ac, Alt+P.\n"
        "   Cikti: public/models/karakter-kit.glb. Sayfayi yenile, karakterler yeni sekliyle gelir.\n"
        "   Komut satirindan: npm run blender:aktar\n",
    )

    for obj in bpy.context.view_layer.objects:
        obj.select_set(False)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children["COL_KIT"]

    os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT, compress=True)
    print(f"[OBA-Tales] {len(kit['parts'])} parca, {len(hidden)} gizli secenek -> {BLEND_OUT}")

    if PREVIEW_OUT:
        scene.render.filepath = PREVIEW_OUT
        scene.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)
        print(f"[OBA-Tales] onizleme -> {PREVIEW_OUT}")


main()
