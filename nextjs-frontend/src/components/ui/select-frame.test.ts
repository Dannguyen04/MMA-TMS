import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Field, Select } from "./form";

describe("Select frame", () => {
    it("keeps a native select and puts the SVG frame on a decorative layer", () => {
        const html = renderToStaticMarkup(
            createElement(
                Select,
                { id: "fighter", "aria-invalid": true, "aria-describedby": "fighter-error", disabled: true },
                createElement("option", { value: "long" }, "Võ sĩ có tên rất dài để kiểm tra nhãn tiếng Việt"),
            ),
        );

        expect(html).toContain("<select");
        expect(html).toContain('id="fighter"');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('aria-describedby="fighter-error"');
        expect(html).toContain("disabled");
        expect(html).toContain("Võ sĩ có tên rất dài để kiểm tra nhãn tiếng Việt");
        expect(html).toContain('class="mma-select-shape"');
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain("mask-border");
        expect(html).not.toContain("lucide");
    });

    it("still wires Field errors onto the native select", () => {
        const control = createElement(Select, { id: "weight-class", name: "weightClass" }, createElement("option", { value: "" }, "— Chưa chọn —"));
        const html = renderToStaticMarkup(
            // Field's prop type requires children; the extra-argument form does not type-check against it.
            // eslint-disable-next-line react/no-children-prop
            createElement(Field, { label: "Hạng cân", htmlFor: "weight-class", error: "Chọn hạng cân", required: true, children: control }),
        );

        expect(html).toContain('for="weight-class"');
        expect(html).toContain('id="weight-class"');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('aria-describedby="weight-class-error"');
        expect(html).toContain('aria-required="true"');
        expect(html).toContain("Chọn hạng cân");
    });
});
