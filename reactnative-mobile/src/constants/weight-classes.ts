export const WEIGHT_CLASSES = [
  "STRAWWEIGHT",
  "FLYWEIGHT",
  "BANTAMWEIGHT",
  "FEATHERWEIGHT",
  "LIGHTWEIGHT",
  "WELTERWEIGHT",
  "MIDDLEWEIGHT",
  "LIGHT_HEAVYWEIGHT",
  "HEAVYWEIGHT",
] as const;

export type WeightClass = (typeof WEIGHT_CLASSES)[number];

export function isWeightClass(value: string): value is WeightClass {
  return (WEIGHT_CLASSES as readonly string[]).includes(value);
}
