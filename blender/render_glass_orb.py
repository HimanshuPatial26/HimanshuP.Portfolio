"""
The hero's liquid glass orb (blender/orb_shape.py), rendered offline in Cycles (transparent
PNG). Used by the loader, the no-WebGL hero and the share image (public/posters/orb.png).

Same look as the live scene: clear, colourless glass in a black-and-white studio. The glass
sees a bright backdrop of warped bands through itself (invisible to the camera), which
refraction bends into the black liquid streaks; the page shows through everywhere else.

  blender --background --factory-startup --python blender/render_glass_orb.py -- public/posters/orb.png [samples]
Set PCT=35 in the environment for a quick low-resolution check.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from orb_shape import build_orb  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :]
OUT = os.path.abspath(args[0])
SAMPLES = int(args[1]) if len(args) > 1 else 40

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
col = sc.collection
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = SAMPLES
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.03
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 16
sc.cycles.glossy_bounces = 8
sc.cycles.transmission_bounces = 16
sc.cycles.transparent_max_bounces = 8
sc.cycles.caustics_reflective = False
sc.cycles.caustics_refractive = False
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = 1366, 768
sc.render.resolution_percentage = int(os.environ.get("PCT", "100"))
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.render.filepath = OUT

# ------------------------------------------------------------------ world: a dark grey studio dome (reflections only)
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
zr = N.new("ShaderNodeMath")  # view direction z (-1..1) → 0..1
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


def panel(name, size, loc, strength):
    """A studio card facing the subject: white softbox (strength > 0) or black flag (0). Never seen by the camera."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("Z", "Y").to_euler()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    mn = m.node_tree.nodes
    for n in list(mn):
        mn.remove(n)
    em = mn.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1, 1, 1, 1) if strength > 0 else (0, 0, 0, 1)
    em.inputs["Strength"].default_value = strength
    o = mn.new("ShaderNodeOutputMaterial")
    m.node_tree.links.new(em.outputs[0], o.inputs["Surface"])
    ob.data.materials.append(m)
    ob.visible_camera = False
    ob.visible_shadow = False
    ob.visible_transmission = False  # through the glass, only the banded backdrop
    return ob


# the live scene's studio, converted from three.js (x, y, z) to Blender (x, -z, y)
panel("top", (30, 2.4), (0, -6, 14), 9)
panel("left", (2.4, 20), (-14, -8, 2), 7)
panel("right", (1.6, 16), (13, -9, -1), 7)
panel("back", (18, 12), (-9, 15, 5), 1.6)
panel("back2", (10, 16), (11, 13, -3), 1.1)
panel("fill", (16, 7), (0, -18, 3), 0.7)
panel("sky", (40, 16), (0, 2, 20), 0.45)
for i, (size, loc) in enumerate(
    [((5, 26), (-7, 11, 0)), ((4, 26), (6, 14, 0)), ((26, 3), (0, -10, -9)), ((4, 30), (-7, -15, 0)), ((3, 30), (6, -16, 0)), ((30, 2.5), (0, -14, 8))]
):
    panel(f"flag{i}", size, loc, 0)

# ------------------------------------------------------------------ what the glass sees through itself: warped, mostly-white bands
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 6, 0))
bd = bpy.context.active_object
bd.name = "bands"
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
wave.inputs["Scale"].default_value = float(os.environ.get("BANDS", "2.2"))
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
em.inputs["Strength"].default_value = 1.0
ml.new(cr.outputs["Color"], em.inputs["Color"])
o = mn.new("ShaderNodeOutputMaterial")
ml.new(em.outputs[0], o.inputs["Surface"])
bd.data.materials.append(m)
bd.visible_camera = False
bd.visible_glossy = False
bd.visible_diffuse = False
bd.visible_shadow = False


# ------------------------------------------------------------------ clear glass, with a little dispersion if this Blender has it
def glass_material():
    gm = bpy.data.materials.new("glass")
    gm.use_nodes = True
    gn, gl = gm.node_tree.nodes, gm.node_tree.links
    for n in list(gn):
        gn.remove(n)
    out = gn.new("ShaderNodeOutputMaterial")
    g = gn.new("ShaderNodeBsdfGlass")
    g.inputs["Color"].default_value = (1, 1, 1, 1)
    g.inputs["Roughness"].default_value = 0.01
    g.inputs["IOR"].default_value = 1.55
    if "Dispersion" in g.inputs:
        g.inputs["Dispersion"].default_value = 0.035
    gl.new(g.outputs[0], out.inputs["Surface"])
    return gm


glass = glass_material()


def shade_smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


# ------------------------------------------------------------------ the orb, and the liquid sheet inside it
shell, liquid = build_orb(col)
shell.data.materials.append(glass)
lm = bpy.data.materials.new("liquid")
lm.use_nodes = True
lp = lm.node_tree.nodes.get("Principled BSDF")
lp.inputs["Base Color"].default_value = (0.95, 0.95, 0.95, 1)
lp.inputs["Metallic"].default_value = 1.0
lp.inputs["Roughness"].default_value = 0.05
liquid.data.materials.append(lm)
for ob in (shell, liquid):
    ob.rotation_euler = (0, 0, math.radians(float(os.environ.get("TURN", "0"))))

cam = bpy.data.cameras.new("cam")
cam.lens = 50
co = bpy.data.objects.new("cam", cam)
col.objects.link(co)
co.location = Vector((0.0, -9.6, 0.7))
co.rotation_euler = (Vector((0, 0, -0.05)) - co.location).to_track_quat("-Z", "Y").to_euler()
sc.camera = co
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
