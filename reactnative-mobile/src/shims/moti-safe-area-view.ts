/**
 * Stand-in for moti's SafeAreaView export.
 * moti's barrel imports SafeAreaView from react-native, which logs a removal
 * warning in React Native 0.86 as soon as the module is evaluated.
 * App screens do not render MotiSafeAreaView; this keeps the export on the
 * supported safe-area component.
 */
export { SafeAreaView } from "react-native-safe-area-context";
