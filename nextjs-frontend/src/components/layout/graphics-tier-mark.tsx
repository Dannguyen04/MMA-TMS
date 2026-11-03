"use client";

import { useEffect } from "react";

import { graphicsTier } from "@/lib/graphics-tier";

/** Writes this device's graphics tier to `<html data-graphics>` on every page, so `lite:` styles apply app-wide. */
export function GraphicsTierMark() {
    useEffect(() => {
        graphicsTier();
    }, []);
    return null;
}
