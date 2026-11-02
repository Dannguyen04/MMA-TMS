import { describe, expect, it } from "vitest";

import { classifyGraphics, parseGraphicsOverride } from "./graphics-tier";

describe("classifyGraphics", () => {
    it("keeps full quality on a capable machine", () => {
        expect(classifyGraphics({ cores: 14, memoryGb: 8, renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)" })).toBe("full");
        expect(classifyGraphics({ cores: 8, renderer: "ANGLE (Intel, Intel(R) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)" })).toBe("full");
        expect(classifyGraphics({ cores: 8, renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)" })).toBe("full");
    });

    it("goes lite on software rendering", () => {
        expect(classifyGraphics({ cores: 16, renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" })).toBe("lite");
        expect(classifyGraphics({ cores: 16, renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" })).toBe("lite");
        expect(classifyGraphics({ cores: 16, renderer: "Microsoft Basic Render Driver" })).toBe("lite");
    });

    it("goes lite on older Intel integrated graphics", () => {
        expect(classifyGraphics({ cores: 8, renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)" })).toBe("lite");
        expect(classifyGraphics({ cores: 8, renderer: "ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0, D3D11)" })).toBe("lite");
    });

    it("goes lite on few cores, little memory or save-data", () => {
        expect(classifyGraphics({ cores: 4 })).toBe("lite");
        expect(classifyGraphics({ cores: 8, memoryGb: 4 })).toBe("lite");
        expect(classifyGraphics({ cores: 8, saveData: true })).toBe("lite");
    });

    it("stays full when the browser reports nothing", () => {
        expect(classifyGraphics({})).toBe("full");
    });
});

describe("parseGraphicsOverride", () => {
    it("accepts only the known values", () => {
        expect(parseGraphicsOverride("lite")).toBe("lite");
        expect(parseGraphicsOverride("full")).toBe("full");
        expect(parseGraphicsOverride("auto")).toBe("auto");
        expect(parseGraphicsOverride("ultra")).toBeNull();
        expect(parseGraphicsOverride(null)).toBeNull();
    });
});
