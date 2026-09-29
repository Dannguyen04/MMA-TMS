/**
 * The photographic plate of the stands behind the cage, and how the stage wraps it round the
 * camera. Kept free of three.js so the poster shown before WebGL loads can use the same image.
 */
export const ARENA_PLATE = {
    url: "/images/landing/arena-backdrop.webp",
    /** Heading of the plate's centre, radians from +Z: behind the fighter across the chapter shots. */
    yaw: Math.PI + 0.2,
    /** Horizontal angle the plate's width covers, radians. Its height follows at the same scale. */
    span: 1.95,
    /** Width over height of the image. */
    aspect: 1672 / 941,
    /** Height of the horizon (eye level) in the image, 0 at the bottom edge to 1 at the top. */
    horizon: 0.46,
    /** Brightness of the plate in the scene. */
    exposure: 0.5,
} as const;
