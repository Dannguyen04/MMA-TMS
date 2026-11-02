// Native: R3F trên expo-gl + drei/native (useGLTF qua expo-asset).
export { Canvas, useFrame, useThree } from "@react-three/fiber/native";
export { useGLTF } from "@react-three/drei/native";
/** Native: useGLTF nhận thẳng module asset (số do require trả về). */
export const resolveModelSource = (mod: number): unknown => mod;
