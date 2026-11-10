"""
Rendered tiles for the Work cards: one clear-glass object per case study, rendered
offline in Cycles on a transparent background. The card behind it supplies the
colour (electric blue for AI work, graphite for growth work), so one render
serves both themes. Same look as the live scene and render_glass_ring.py: the
glass sees a backdrop of warped bands through itself (invisible to the camera),
which refraction turns into black liquid streaks.

Run headless (renders every tile, or only the ids you list after the samples):
  blender --background --factory-startup --python blender/render_case_tiles.py -- public/models/chrome-shapes.glb public/tiles [samples] [id ...]
Set PCT=30 in the environment for a quick low-resolution check.

Tiles (file name = case-study id in src/data/resume.ts):
  doubt-mate        a speech bubble with a typing indicator   (AI tutor chatbot)
  call-analysis     a waveform of rounded bars                (AI call reviews)
  ai-convert        the growth curve, Shape_Curve             (conversion engine)
  payment-recovery  the phone, Shape_Phone                    (WhatsApp payment journeys)
  crm-lms           a funnel with leads dropping in           (lead scoring)
  super-coaching    the stairs, Shape_Stairs                  (onboarding overlay)

Lighting: a monochrome studio, dark grey dome, white strip lights, black flags and a
"horizon" softbox behind the camera (bright below a crisp line, dark above).
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1 :]
GLB, OUT = os.path.abspath(args[0]), os.path.abspath(args[1])
SAMPLES = int(args[2]) if len(args) > 2 else 48
ONLY = set(args[3:])
PCT = int(os.environ.get("PCT", "100"))
W, H = 1200, 750
LENS = 60


# ------------------------------------------------------------------ scene setup
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.03
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 16
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 8
    sc.cycles.transmission_bounces = 16
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.6
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = PCT
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    world(sc)
    return sc


def world(sc):
    """Reflections see a dark grey studio dome."""
    w = bpy.data.worlds.new("studio")
    sc.world = w
    w.use_nodes = True
    N, L = w.node_tree.nodes, w.node_tree.links
    for n in list(N):
        N.remove(n)
    out = N.new("ShaderNodeOutputWorld")
    bg = N.new("ShaderNodeBackground")
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Generated"], sep.inputs[0])
    # a world's Generated coordinate is the view direction (-1..1): remap z to 0..1
    zr = N.new("ShaderNodeMath")
    zr.operation = "MULTIPLY_ADD"
    zr.inputs[1].default_value = 0.5
    zr.inputs[2].default_value = 0.5
    L.new(sep.outputs["Z"], zr.inputs[0])
    ramp = N.new("ShaderNodeValToRGB")
    L.new(zr.outputs[0], ramp.inputs[0])
    r = ramp.color_ramp
    r.elements[0].position, r.elements[0].color = 0.0, (0.015, 0.015, 0.015, 1)
    r.elements[1].position, r.elements[1].color = 1.0, (0.25, 0.25, 0.25, 1)
    r.elements.new(0.42).color = (0.03, 0.03, 0.03, 1)
    r.elements.new(0.5).color = (0.12, 0.12, 0.12, 1)
    L.new(ramp.outputs["Color"], bg.inputs["Color"])
    L.new(bg.outputs["Background"], out.inputs["Surface"])


def softbox(name, size, loc, strength, color=(1, 1, 1), horizon=False):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("Z", "Y").to_euler()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    mn, ml = m.node_tree.nodes, m.node_tree.links
    for n in list(mn):
        mn.remove(n)
    em = mn.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    if horizon:
        tc = mn.new("ShaderNodeTexCoord")
        sp = mn.new("ShaderNodeSeparateXYZ")
        rp = mn.new("ShaderNodeValToRGB")
        ml.new(tc.outputs["Generated"], sp.inputs[0])
        ml.new(sp.outputs["Y"], rp.inputs[0])
        r = rp.color_ramp
        r.elements[0].position, r.elements[0].color = 0.0, (0.55, 0.57, 0.62, 1)
        r.elements[1].position, r.elements[1].color = 1.0, (0.0, 0.0, 0.0, 1)
        r.elements.new(0.47).color = (1.0, 1.0, 1.0, 1)
        r.elements.new(0.53).color = (0.02, 0.025, 0.04, 1)
        ml.new(rp.outputs["Color"], em.inputs["Color"])
    o = mn.new("ShaderNodeOutputMaterial")
    ml.new(em.outputs[0], o.inputs["Surface"])
    ob.data.materials.append(m)
    ob.visible_camera = False
    ob.visible_shadow = False
    ob.visible_transmission = False


def lights(cam_dist):
    softbox("top", (9, 1.4), (0.5, 1.0, 6.5), 14)
    softbox("left", (1.4, 7), (-5.5, -1.5, 1.0), 11)
    softbox("rim", (0.8, 6), (4.8, 1.8, 0.5), 16)
    softbox("horizon", (16, 11), (0.6, -(cam_dist + 8.5), -0.6), 3.2, (0.95, 0.97, 1.0), horizon=True)
    # black flags around the camera: dark bands in the reflections
    for i, (size, loc) in enumerate([((4, 30), (-7, -cam_dist - 5, 0)), ((3, 30), (6, -cam_dist - 6, 0)), ((30, 2.5), (0, -cam_dist - 4, 8))]):
        softbox(f"flag{i}", size, loc, 0, (0, 0, 0))
    # what the glass sees through itself: warped, mostly-white bands behind the object
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 6, 0))
    bd = bpy.context.active_object
    bd.scale = (34, 20, 1)
    bd.rotation_euler = (math.radians(90), 0, 0)
    m = bpy.data.materials.new("bands")
    m.use_nodes = True
    mn, ml = m.node_tree.nodes, m.node_tree.links
    for n in list(mn):
        mn.remove(n)
    tco = mn.new("ShaderNodeTexCoord")
    wave = mn.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 2.2
    wave.inputs["Distortion"].default_value = 3.0
    wave.inputs["Detail"].default_value = 1.5
    ml.new(tco.outputs["Generated"], wave.inputs["Vector"])
    cr = mn.new("ShaderNodeValToRGB")
    ml.new(wave.outputs["Fac"], cr.inputs[0])
    c = cr.color_ramp
    c.elements[0].position, c.elements[0].color = 0.0, (0.03, 0.03, 0.03, 1)
    c.elements[1].position, c.elements[1].color = 1.0, (0.9, 0.9, 0.9, 1)
    c.elements.new(0.09).color = (0.03, 0.03, 0.03, 1)
    c.elements.new(0.2).color = (0.9, 0.9, 0.9, 1)
    em = mn.new("ShaderNodeEmission")
    ml.new(cr.outputs["Color"], em.inputs["Color"])
    o = mn.new("ShaderNodeOutputMaterial")
    ml.new(em.outputs[0], o.inputs["Surface"])
    bd.data.materials.append(m)
    bd.visible_camera = False
    bd.visible_glossy = False
    bd.visible_diffuse = False
    bd.visible_shadow = False


def glass():
    m = bpy.data.materials.get("glass") or bpy.data.materials.new("glass")
    m.use_nodes = True
    mn = m.node_tree.nodes
    for n in list(mn):
        mn.remove(n)
    g = mn.new("ShaderNodeBsdfGlass")
    g.inputs["Color"].default_value = (1, 1, 1, 1)
    g.inputs["Roughness"].default_value = 0.01
    g.inputs["IOR"].default_value = 1.55
    o = mn.new("ShaderNodeOutputMaterial")
    m.node_tree.links.new(g.outputs[0], o.inputs["Surface"])
    return m


# ------------------------------------------------------------------ geometry helpers
def link(me, name):
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def rounded_box(size, loc, bevel, name="box", segments=6):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(loc) @ Matrix.Diagonal((*size, 1)))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, affect="EDGES", profile=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(me, name)


def ball(r, loc, name="ball"):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=r, matrix=Matrix.Translation(loc))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(me, name)
    ob.data.polygons.foreach_set("use_smooth", [True] * len(ob.data.polygons))
    return ob


def select_only(obs):
    for o in bpy.context.scene.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]


def fuse(obs, name, voxel=0.02):
    """Join, voxel-remesh into one even surface, smooth, shade smooth (same finish as the site's shapes)."""
    select_only(obs)
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    rm = ob.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    sm = ob.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.6
    sm.iterations = 6
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.shade_smooth()
    return ob


def import_shape(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=GLB)
    keep = None
    for o in set(bpy.data.objects) - before:
        if o.name == name:
            keep = o
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    select_only([keep])
    keep.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    return keep


# ------------------------------------------------------------------ the objects (front faces look towards -Y, the camera)
def speech_bubble():
    body = rounded_box((4.2, 0.8, 2.7), (0, 0, 0.35), 0.62, "bubble", 10)
    # the tail: a rounded wedge, tipped down-left and fused into the body
    tail = rounded_box((0.95, 0.66, 1.45), (0, 0, 0), 0.3, "tail", 8)
    tail.rotation_euler = (0, math.radians(-38), 0)
    tail.location = (-1.25, 0, -1.0)
    ob = fuse([body, tail], "bubble")
    dots = [ball(0.3, (x, -0.42, 0.35), "dot") for x in (-1.05, 0, 1.05)]
    return [ob, *dots], (math.radians(4), 0, math.radians(-16))


def waveform():
    hs = [0.55, 1.05, 1.8, 2.7, 1.9, 3.1, 2.3, 1.45, 2.15, 1.0, 0.55]
    bars = []
    for i, h in enumerate(hs):
        x = (i - (len(hs) - 1) / 2) * 0.44
        bars.append(rounded_box((0.3, 0.3, h), (x, 0, 0), 0.149, "bar", 8))
    return [fuse(bars, "wave", 0.016)], (math.radians(6), 0, math.radians(-24))


def funnel():
    # a lathed profile, given thickness, with a rolled rim and three leads dropping in
    prof = [(2.05, 1.45), (1.95, 1.3), (1.2, 0.55), (0.5, -0.35), (0.42, -0.7), (0.42, -1.75)]
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in prof]
    for a, b in zip(vs, vs[1:]):
        bm.edges.new((a, b))
    me = bpy.data.meshes.new("funnel")
    bm.to_mesh(me)
    bm.free()
    ob = link(me, "funnel")
    sc = ob.modifiers.new("Lathe", "SCREW")
    sc.steps = 96
    sc.render_steps = 96
    sc.use_merge_vertices = True
    so = ob.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = 0.16
    so.offset = 0
    select_only([ob])
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.mesh.primitive_torus_add(major_radius=2.05, minor_radius=0.13, major_segments=128, minor_segments=24, location=(0, 0, 1.45))
    rim = bpy.context.active_object
    body = fuse([ob, rim], "funnel", 0.022)
    body.rotation_euler = (math.radians(-22), 0, 0)
    select_only([body])
    bpy.ops.object.transform_apply(rotation=True)
    leads = [ball(0.36, (-0.6, -0.5, 2.5), "lead"), ball(0.3, (0.75, -0.2, 3.05), "lead"), ball(0.25, (0.05, -0.9, 3.55), "lead")]
    return [body, *leads], (0, 0, math.radians(-10))


def glb(name, rot):
    def make():
        return [import_shape(name)], rot

    return make


TILES = {
    "doubt-mate": speech_bubble,
    "call-analysis": waveform,
    "ai-convert": glb("Shape_Curve", (0, 0, math.radians(-18))),
    "payment-recovery": glb("Shape_Phone", (math.radians(4), 0, math.radians(26))),
    "crm-lms": funnel,
    "super-coaching": glb("Shape_Stairs", (math.radians(6), 0, math.radians(-30))),
}


# ------------------------------------------------------------------ render
def render(tile_id, make):
    sc = reset()
    obs, rot = make()
    mat = glass()
    pivot = bpy.data.objects.new("pivot", None)
    sc.collection.objects.link(pivot)
    for o in obs:
        o.data.materials.clear()
        o.data.materials.append(mat)
        o.parent = pivot
    pivot.rotation_euler = rot
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    pivot.location = -(lo + hi) / 2
    bpy.context.view_layer.update()
    size = hi - lo
    half_w = 18 / LENS  # tan of half the horizontal field of view (36 mm sensor)
    half_h = half_w * H / W
    dist = max((size.z / 2) / (0.74 * half_h), (size.x / 2) / (0.72 * half_w)) + size.y * 0.25
    lights(dist)
    cam = bpy.data.cameras.new("cam")
    cam.lens = LENS
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    co.location = Vector((0.25, -dist, dist * 0.09))
    co.rotation_euler = (Vector((0, 0, 0)) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = co
    sc.render.filepath = os.path.join(OUT, tile_id + ".png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", tile_id, "size", tuple(round(v, 2) for v in size))


os.makedirs(OUT, exist_ok=True)
for tid, fn in TILES.items():
    if not ONLY or tid in ONLY:
        render(tid, fn)
