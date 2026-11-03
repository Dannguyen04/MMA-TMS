# 3D models

## fighter-body.glb

- Title: "Male base muscular anatomy"
- Author: Harshit Prajapati (https://sketchfab.com/harshit77)
- Source: https://sketchfab.com/3d-models/male-base-muscular-anatomy-0954aa04666d45aab9633009318f7b66
- Licence: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)
- Changes: lateral rib surface repaired in Blender, A-pose kept, quantised with glTF-Transform (KHR_mesh_quantization);
  `_GEO0`–`_GEO3` hold joint-region masks (low value = inside the region) used to place the body-map regions.
  The app renders it with its own shader and rescales it to the fighter's height.

The credit is also shown under every 3D body in the app (`ModelCredit` in `src/components/fighter-3d/body/`).
