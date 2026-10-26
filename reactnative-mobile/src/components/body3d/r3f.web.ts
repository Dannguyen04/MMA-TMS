// Web: R3F DOM (canvas WebGL2) + drei; asset .glb lấy URL qua expo-asset.
import { Asset } from "expo-asset";

export { Canvas, useFrame, useThree } from "@react-three/fiber";
export { useGLTF } from "@react-three/drei";
export const resolveModelSource = (mod: number): unknown => Asset.fromModule(mod).uri;
