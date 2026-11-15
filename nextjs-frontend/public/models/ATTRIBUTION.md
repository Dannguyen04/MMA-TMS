# 3D models

## fighter-body.glb

- Title: "Male base muscular anatomy"
- Author: Harshit Prajapati (https://sketchfab.com/harshit77)
- Source: https://sketchfab.com/3d-models/male-base-muscular-anatomy-0954aa04666d45aab9633009318f7b66
- Licence: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
- Changes: lateral rib surface repaired in Blender, A-pose kept, quantised with glTF-Transform (KHR_mesh_quantization);
  `_GEO0`–`_GEO3` hold joint-region masks (low value = inside the region) used to place the body-map regions.
  The app renders it with its own shader and rescales it to the fighter's height.

This file is the model's credit; the app no longer prints it on screen (teacher's review, 15/11/2026).

`fighter-body.wire.bin` is derived from it: the edges of the model simplified to 5k triangles (meshoptimizer),
as Uint16 vertex-index pairs into the model's own vertex order, for the wireframe drawn over the body.

## fighter-body-female.glb

- Made by the MMA-TMS team in Blender (`bodybodyheyGLB.glb`, handed over 14/11/2026): a female muscular anatomy
  figure with a separate sports top and shorts, A-pose, no rig, no textures. Team work, no outside licence.
- Changes: outfit simplified from 68k to 14k triangles (meshoptimizer) and lifted 3 mm off the skin so the
  see-through look never shows both layers; body and outfit merged into one mesh and written in app space
  (soles on y = 0, 1.75 m, centred on the mean x/z).

`fighter-body-female.wire.bin`: the same kind of wireframe file as the male one, from this model.

`fighter-body-female.regions.bin`: the doctor body map's region fields for this model (same slots as the male
`_GEO0`–`_GEO3`), baked by `scripts/bake-female-regions.mjs`.
