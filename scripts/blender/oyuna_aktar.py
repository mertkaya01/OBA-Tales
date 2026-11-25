"""OBA-Tales: Blender'daki karakter kitini oyuna aktarır -> public/models/karakter-kit.glb

Blender içinden:  Text Editor'de "OBA-Tales_oyuna_aktar.py" açıkken Alt+P (Run Script).
                  .blend dosyası proje içindeki modeller/ klasöründe kayıtlı olmalı.
Komut satırından: npm run blender:aktar
Doğrudan:         blender --background modeller/OBA-Tales-karakter-kit.blend --python-exit-code 1 \
                    --python scripts/blender/oyuna_aktar.py -- [cikti.glb]

Yalnızca COL_KIT koleksiyonundaki ağlar (gizliler dahil) aktarılır. Ayarlar:
  glTF ikili (.glb), +Y Up (oyunun ekseni), dönüşümler ve değiştiriciler (Mirror, Bevel ...) uygulanmış,
  malzemesiz (renkleri oyun her takipçiye kendisi verir), nesne özellikleri (oba_parca) "extras" olarak.
"""

import json
import os
import sys

import bpy

KIT_ROOT = "COL_KIT"
DEFAULT_OUT = "//../public/models/karakter-kit.glb"
PART_BUDGET = 350  # tek parçada bundan fazla üçgen varsa uyar
CHARACTER_BUDGET = 1500  # açık (görünen) parçaların toplamı için


def output_path():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if argv:
        return os.path.abspath(argv[0])
    if not bpy.data.filepath:
        raise RuntimeError("Önce bu dosyayı projedeki modeller/ klasörüne kaydet (Ctrl+S).")
    return os.path.abspath(bpy.path.abspath(DEFAULT_OUT))


def known_ids():
    """Oyundaki parça kimlikleri (modeller/kit.json), bulunamazsa None."""
    path = bpy.path.abspath("//kit.json") if bpy.data.filepath else ""
    if not path or not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return {p["id"] for p in json.load(f)["parts"]}


def part_id(obj):
    o = obj
    while o is not None:
        tag = o.get("oba_parca")
        if isinstance(tag, str):
            return tag
        o = o.parent
    name = obj.name
    while len(name) > 4 and name[-4] == "." and name[-3:].isdigit():
        name = name[:-4]
    return name


def layer_collections(layer, inside=False):
    inside = inside or layer.name == KIT_ROOT
    if inside:
        yield layer
    for child in layer.children:
        yield from layer_collections(child, inside)


def triangles(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    count = sum(len(p.vertices) - 2 for p in mesh.polygons)
    evaluated.to_mesh_clear()
    return count


def export(out_path):
    root = bpy.data.collections.get(KIT_ROOT)
    if root is None:
        raise RuntimeError(f"{KIT_ROOT} koleksiyonu bulunamadı: parçalar onun içinde olmalı.")
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    view_layer = bpy.context.view_layer
    layers = list(layer_collections(view_layer.layer_collection))
    layer_state = [(l, l.exclude, l.hide_viewport) for l in layers]
    for l in layers:
        l.exclude = False
        l.hide_viewport = False
    objects = [o for o in root.all_objects if o.type == "MESH"]
    object_state = [(o, o.hide_get(), o.hide_viewport, o.select_get()) for o in view_layer.objects]
    active = view_layer.objects.active
    try:
        for o in view_layer.objects:
            o.select_set(False)
        for o in objects:
            o.hide_viewport = False
            o.hide_set(False)
            o.select_set(True)
        view_layer.objects.active = objects[0] if objects else None

        depsgraph = bpy.context.evaluated_depsgraph_get()
        ids = known_ids()
        report = {}
        unknown = []
        for o in objects:
            pid = part_id(o)
            report[pid] = report.get(pid, 0) + triangles(o, depsgraph)
            if ids is not None and pid not in ids:
                unknown.append(o.name)
        visible_tris = sum(
            triangles(o, depsgraph) for o, hidden, _, _ in object_state if o in objects and not hidden
        )

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_extras=True,
            export_materials="NONE",
            export_texcoords=False,
            export_normals=False,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
        )
    finally:
        for o, hidden, hide_viewport, selected in object_state:
            o.hide_viewport = hide_viewport
            o.hide_set(hidden)
            o.select_set(selected)
        view_layer.objects.active = active
        for l, exclude, hide_viewport in layer_state:
            l.exclude = exclude
            l.hide_viewport = hide_viewport

    lines = [f"[OBA-Tales] {len(objects)} nesne, {len(report)} parca -> {out_path}"]
    for pid, tris in sorted(report.items()):
        flag = "  <- agir" if tris > PART_BUDGET else ""
        lines.append(f"    {pid:<22}{tris:>6} ucgen{flag}")
    lines.append(f"  Acik parcalarin toplami: {visible_tris} ucgen (hedef <= {CHARACTER_BUDGET})")
    if unknown:
        lines.append("  ! Oyunun tanimadigi adlar (oyun bunlari yok sayar): " + ", ".join(unknown))
        lines.append("    Ad ya da 'oba_parca' ozelligi bir parca kimligi olmali (kafa, kalkan, yay ...).")
    print("\n".join(lines))
    return lines


def notify(lines):
    if bpy.app.background:
        return

    def draw(self, _context):
        for line in lines[:1] + lines[-3:]:
            self.layout.label(text=line.strip())

    bpy.context.window_manager.popup_menu(draw, title="OBA-Tales: oyuna aktarıldı", icon="CHECKMARK")


notify(export(output_path()))
