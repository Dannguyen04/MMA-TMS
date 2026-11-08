import { BellRing } from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SegmentedLinks } from "./segmented-links";

const ITEMS = [
    { href: "/a?status=new", label: "Mới", count: 2, icon: BellRing },
    { href: "/a?status=follow", label: "Theo dõi", count: 3, icon: BellRing },
    { href: "/a?status=ack", label: "Đã xác nhận", count: 1, icon: BellRing },
    { href: "/a?status=dismissed", label: "Đã bỏ qua", count: 1, icon: BellRing },
    { href: "/a", label: "Tất cả", count: 7, icon: BellRing },
];

describe("SegmentedLinks", () => {
    it.each(ITEMS.map((item) => item.label))("marks only %s as the current filter", (label) => {
        const html = renderToStaticMarkup(
            createElement(SegmentedLinks, {
                label: "Lọc quan sát theo trạng thái",
                items: ITEMS.map((item) => ({ ...item, active: item.label === label })),
            }),
        );
        const selected = html.split("<a ").filter((part) => part.includes(`>${label}`) || part.includes(`>${label}<`) || part.includes(label));
        expect(html).toContain(`aria-current="page"`);
        expect(html.match(/aria-current="page"/g)).toHaveLength(1);
        expect(html).toContain('data-selected="true"');
        expect(html.match(/data-selected="true"/g)).toHaveLength(1);
        expect(selected.join("")).toContain(label);
    });
});
