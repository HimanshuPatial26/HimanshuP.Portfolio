"""
The hero element: a liquid glass orb (form taken from his reference board).

  - a sphere, a touch wider than tall
  - a liquid ribbon on a tilted, wavy path that swells out at the left and right
    edges; across the front the wave is the liquid inside
  - froth: fused bubbles clustered where the ribbon meets the left and right
    edges, a few more on the upper left
  - a handful of loose droplets beside it
  - inside, a wavy liquid surface (a separate thin sheet, Globe_Liquid)

Used by build_chrome_shapes.py (exported as Shape_Globe + Globe_Liquid for the live
site) and by render_glass_orb.py (the offline Cycles render). Deterministic.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

# the ribbon's path is tilted so it sweeps across the front diagonally
TILT = Matrix.Rotation(math.radians(-16), 4, "Y") @ Matrix.Rotation(math.radians(3), 4, "X")
BODY_R = 1.36  # where the body's surface lands: metaball radius 2.0 at stiffness 2, threshold 0.6


def _band(a):
    """A point on the ribbon's centre line, angle a around the vertical axis (0 = right edge)."""
    z = 0.3 * math.sin(2 * a + 0.6) - 0.06
    return TILT @ Vector((BODY_R * 0.97 * math.cos(a), BODY_R * 0.97 * math.sin(a), z))


def _select_only(obs):
    for o in bpy.context.scene.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]


def _apply_all(ob):
    _select_only([ob])
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def build_orb(col, voxel=0.024, target_faces=60000, size=3.6):
    """Builds Shape_Globe (the glass shell, froth and droplets) and Globe_Liquid. Returns both."""
    rnd = random.Random(7)
    mb = bpy.data.metaballs.new("orb")
    mb.resolution = 0.05
    mb.render_resolution = 0.05
    mb.threshold = 0.6
    orb = bpy.data.objects.new("orb", mb)
    col.objects.link(orb)

    def ball(co, r, stiff=2.0):
        e = mb.elements.new()
        e.co = co
        e.radius = r
        e.stiffness = stiff
        return e

    # body
    body = ball((0, 0, 0), 2.0)
    body.type = "ELLIPSOID"
    body.size_x, body.size_y, body.size_z = 1.04, 1.0, 0.94

    # the liquid ribbon: a chain of balls along the band where it reaches the sides (the front
    # stays clean glass; the wave across it is the liquid inside)
    n = 48
    for i in range(n):
        a = 2 * math.pi * i / n
        side = abs(math.cos(a))
        if side < 0.45:
            continue
        ball(_band(a) * 0.95, 0.07 + 0.15 * side, 2.0)

    # froth: bubbles along the ribbon, crowded at the left and right edges
    for i in range(320):
        a = rnd.uniform(0, 2 * math.pi)
        side = abs(math.cos(a))
        if rnd.random() > 0.02 + 0.98 * side**5:
            continue
        p = _band(a) + Vector((0, 0, rnd.uniform(-0.3, 0.3)))
        p = p.normalized() * (BODY_R + rnd.uniform(0.0, 0.2))
        ball(p, rnd.uniform(0.05, 0.17) * (0.75 + 0.45 * side), 2.5)

    # a small cluster on the upper left
    for _ in range(9):
        d = Vector((-0.75 + rnd.uniform(-0.18, 0.18), rnd.uniform(-0.5, 0.2), 0.62 + rnd.uniform(-0.12, 0.15))).normalized()
        ball(d * BODY_R * 0.93, rnd.uniform(0.05, 0.12), 2.5)

    # metaballs → mesh, voxel-remesh to one even surface, a little liquid irregularity, smooth
    _select_only([orb])
    bpy.ops.object.convert(target="MESH")
    shell = bpy.context.view_layer.objects.active
    rm = shell.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    tex = bpy.data.textures.new("orb_ripple", "CLOUDS")
    tex.noise_scale = 0.7
    dsp = shell.modifiers.new("Ripple", "DISPLACE")
    dsp.texture = tex
    dsp.strength = 0.035
    sm = shell.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.5
    sm.iterations = 4
    _apply_all(shell)

    # loose droplets beside the orb (separate islands of the same mesh)
    drops = []
    for co, r in [((1.9, -0.35, -0.3), 0.11), ((1.75, -0.5, 0.4), 0.07), ((-1.95, -0.3, 0.12), 0.08), ((2.08, -0.2, 0.12), 0.05)]:
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r, matrix=Matrix.Translation(Vector(co)))
        me = bpy.data.meshes.new("drop")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("drop", me)
        col.objects.link(ob)
        drops.append(ob)
    _select_only([shell, *drops])
    bpy.ops.object.join()
    shell = bpy.context.view_layer.objects.active

    if len(shell.data.polygons) > target_faces:
        dec = shell.modifiers.new("Decimate", "DECIMATE")
        dec.ratio = target_faces / len(shell.data.polygons)
        _apply_all(shell)

    # the liquid inside: a wavy, slightly swirled sheet at the ribbon's level, well inside the shell
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=BODY_R * 0.86, segments=72)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=12, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for v in bm.verts:
        x, y = v.co.x, v.co.y
        r = math.hypot(x, y)
        ang = math.atan2(y, x) + 0.5 * r  # swirl
        v.co.z = 0.14 * math.sin(1.2 * x + 0.5) + 0.07 * math.sin(1.8 * y - 0.3) + 0.05 * math.sin(2 * ang) * r - 0.08
    me = bpy.data.meshes.new("liquid")
    bm.to_mesh(me)
    bm.free()
    liquid = bpy.data.objects.new("Globe_Liquid", me)
    col.objects.link(liquid)
    liquid.matrix_world = TILT
    so = liquid.modifiers.new("Solid", "SOLIDIFY")
    so.thickness = 0.05
    so.offset = 0
    _apply_all(liquid)
    _select_only([liquid])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # fit both together: centre on the shell, scale its largest extent to `size`
    vs = [v.co for v in shell.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    k = size / max(hi - lo)
    fit = Matrix.Scale(k, 4) @ Matrix.Translation(-(lo + hi) / 2)
    shell.data.transform(fit)
    liquid.data.transform(fit)
    for ob in (shell, liquid):
        _select_only([ob])
        bpy.ops.object.shade_smooth()
    shell.name = "Shape_Globe"
    print("orb faces", len(shell.data.polygons), "liquid faces", len(liquid.data.polygons))
    return shell, liquid
