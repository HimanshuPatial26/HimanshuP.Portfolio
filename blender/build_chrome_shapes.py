"""
Chrome versions of the section shapes, for the liquid-chrome scene.

Unlike the earlier particle shapes (thin wireframes sampled into points), these are
chunky, rounded solids meant to be rendered as polished metal. Each one is
voxel-remeshed so its surface is evenly and densely triangulated: the site
melts every shape into a liquid blob between sections, and that only looks
smooth when the vertices are spread evenly.

Run headless:
  blender --background --factory-startup --python blender/build_chrome_shapes.py -- public/models/chrome-shapes.glb

Objects (names are read by the site's data-shape attributes; keep them stable):
  Shape_Globe     hero      the liquid glass orb (blender/orb_shape.py)
  Globe_Liquid    hero      the wavy liquid sheet inside the orb
  Shape_Monogram  about     extruded, bevelled "hp"
  Shape_Curve     case      a rising growth curve as a thick tube with data points
  Shape_Phone     work      a rounded phone slab with raised app cards
  Shape_Stairs    journey   four rounded steps with a ball on the top one
  Shape_Plane     contact   a thick folded paper plane with a trail of drops
Also exports the ShotIn_/ShotOut_ camera empties: the camera path.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from orb_shape import build_orb  # noqa: E402

argv = sys.argv
out_path = argv[argv.index("--") + 1] if "--" in argv else "chrome-shapes.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = scene.collection

VOXEL = 0.028  # remesh resolution (shapes are ~4 units across)
TARGET_FACES = 22000


def select_only(ob):
    for o in scene.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob


def to_mesh(ob):
    select_only(ob)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.view_layer.objects.active


def apply_all(ob):
    select_only(ob)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def join(obs, name):
    for o in scene.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def normalize(ob, size=4.0):
    me = ob.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    c = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    extent = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)) or 1
    me.transform(Matrix.Translation(-c))
    me.transform(Matrix.Scale(size / extent, 4))


def finish(ob, size):
    """Normalise, voxel-remesh for an even surface, thin it out, shade smooth."""
    apply_all(ob)
    normalize(ob, size)
    rm = ob.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = VOXEL
    rm.adaptivity = 0
    apply_all(ob)
    faces = len(ob.data.polygons)
    if faces > TARGET_FACES:
        dec = ob.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = TARGET_FACES / faces
        apply_all(ob)
    sm = ob.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.6
    sm.iterations = 6
    apply_all(ob)
    select_only(ob)
    bpy.ops.object.shade_smooth()
    print(ob.name, "faces", len(ob.data.polygons))
    return ob


def rounded_box(size, loc, bevel=0.08, name="box"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(loc) @ Matrix.Diagonal((*size, 1)))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=5, affect="EDGES", profile=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def ball(r, loc, name="ball"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r, matrix=Matrix.Translation(loc))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def tube(points, radius, name="tube"):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(points) - 1)
    for p, pt in zip(sp.points, points):
        p.co = (pt.x, pt.y, pt.z, 1)
    sp.use_endpoint_u = True
    sp.order_u = 4
    sp.resolution_u = 6
    ob = bpy.data.objects.new(name, cu)
    col.objects.link(ob)
    return to_mesh(ob)


# --------------------------------------------------------------- "hp" (about)
cu = bpy.data.curves.new("hp_txt", "FONT")
cu.body = "hp"
cu.extrude = 0.3
cu.bevel_depth = 0.06
cu.bevel_resolution = 4
cu.align_x = "CENTER"
cu.align_y = "CENTER"
cu.resolution_u = 12
txt = bpy.data.objects.new("hp_txt", cu)
col.objects.link(txt)
txt.rotation_euler = (math.radians(90), 0, 0)
mono = to_mesh(txt)
mono.name = "Shape_Monogram"
finish(mono, 4.2)

# --------------------------------------------------------------- the hero orb
build_orb(col, target_faces=30000, size=4.4)

# --------------------------------------------------------------- growth curve (case pages)
pts = [Vector((-2.0 + 4.0 * t, 0, 0.2 + 2.5 * (t**2.3))) for t in [i / 24 for i in range(25)]]
parts = [tube(pts, 0.17, "curve")]
for t in (0.25, 0.55, 0.8):
    parts.append(ball(0.24, Vector((-2.0 + 4.0 * t, 0, 0.2 + 2.5 * (t**2.3))), "pt"))
parts.append(ball(0.4, pts[-1], "peak"))
parts.append(rounded_box((4.4, 0.5, 0.16), Vector((0, 0, -0.1)), 0.06, "base"))
curve = join(parts, "Shape_Curve")
curve.rotation_euler = (0, 0, math.radians(-18))
finish(curve, 4.2)

# --------------------------------------------------------------- phone (work)
parts = [rounded_box((1.6, 0.28, 3.25), Vector((0, 0, 0)), 0.2, "body")]
for k, (z, w, h) in enumerate([(1.0, 1.2, 0.38), (0.48, 0.95, 0.38), (-0.04, 1.2, 0.38), (-0.56, 1.2, 0.38)]):
    parts.append(rounded_box((w, 0.12, h), Vector((0, -0.2 - 0.03 * k, z)), 0.05, f"card{k}"))
parts.append(rounded_box((1.1, 0.12, 0.3), Vector((0, -0.2, -1.18)), 0.12, "cta"))
phone = join(parts, "Shape_Phone")
phone.rotation_euler = (math.radians(8), 0, math.radians(-22))
finish(phone, 3.9)

# --------------------------------------------------------------- stairs (journey)
parts = []
for k in range(4):
    h = 0.55 + k * 0.6
    parts.append(rounded_box((0.95, 1.0, h), Vector((-1.5 + k * 1.0, 0, h / 2)), 0.1, f"step{k}"))
parts.append(ball(0.3, Vector((1.5, 0, 0.55 + 3 * 0.6 + 0.32)), "top"))
stairs = join(parts, "Shape_Stairs")
stairs.rotation_euler = (math.radians(10), 0, math.radians(-28))
finish(stairs, 4.0)

# --------------------------------------------------------------- paper plane (contact)
bm = bmesh.new()
nose = bm.verts.new((2.0, 0, 0))
tail_l = bm.verts.new((-1.6, 1.25, 0.05))
tail_r = bm.verts.new((-1.6, -1.25, 0.05))
keel = bm.verts.new((-1.6, 0, -0.55))
mid = bm.verts.new((-1.6, 0, 0.12))
bm.faces.new((nose, tail_l, mid))
bm.faces.new((nose, mid, tail_r))
bm.faces.new((nose, keel, mid))
me = bpy.data.meshes.new("plane")
bm.to_mesh(me)
bm.free()
plane = bpy.data.objects.new("plane", me)
col.objects.link(plane)
sol = plane.modifiers.new("Solid", "SOLIDIFY")
sol.thickness = 0.16
sol.offset = 0
bev = plane.modifiers.new("Bevel", "BEVEL")
bev.width = 0.05
bev.segments = 4
apply_all(plane)
parts = [plane]
for k in range(5):
    t = k / 4
    parts.append(ball(0.16 - 0.07 * t, Vector((-2.05 - t * 1.3, 0.15 * math.sin(t * 3), -0.45 - t * 0.85)), f"drop{k}"))
plane = join(parts, "Shape_Plane")
plane.rotation_euler = (math.radians(18), math.radians(-12), math.radians(-28))
finish(plane, 4.0)

# --------------------------------------------------------------- camera shots


def sph(az, el, d):
    a, e = math.radians(az), math.radians(el)
    return Vector((d * math.cos(e) * math.sin(a), -d * math.cos(e) * math.cos(a), d * math.sin(e)))


shots = {
    "Shape_Globe": (sph(-8, 2, 7.4), sph(10, -1, 6.4)),  # level: the orb's band reads as a wave, not a ring
    "Shape_Monogram": (sph(-26, 6, 7.0), sph(24, -4, 6.8)),
    "Shape_Curve": (sph(-38, -6, 7.2), sph(22, 28, 6.6)),
    "Shape_Phone": (sph(40, 8, 7.0), sph(-36, 4, 6.6)),
    "Shape_Stairs": (sph(30, 2, 7.4), sph(-20, 22, 6.8)),
    "Shape_Plane": (sph(-55, 10, 7.6), sph(-15, 4, 6.6)),
}
for shape, (pin, pout) in shots.items():
    for kind, pos in (("ShotIn", pin), ("ShotOut", pout)):
        e = bpy.data.objects.new(f"{kind}_{shape}", None)
        e.location = pos
        col.objects.link(e)

# --------------------------------------------------------------- export
for o in list(scene.objects):
    if not o.name.startswith(("Shape_", "Globe_", "ShotIn_", "ShotOut_")):
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_texcoords=False,
    export_materials="NONE",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
)
print("EXPORTED", out_path, sorted(o.name for o in scene.objects))
