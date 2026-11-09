import type { MetadataRoute } from "next";

/**
 * Lets a fighter add the app to the phone's home screen and open it full screen. Colours are the light theme's
 * plane and the stage navy (DESIGN.md); the name stays the product name in both languages.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "MMA-TMS — Training & Health",
        short_name: "MMA-TMS",
        description: "Fight camp, training and medical clearance for an MMA academy.",
        start_url: "/login",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0e1a2b",
        theme_color: "#0e1a2b",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
