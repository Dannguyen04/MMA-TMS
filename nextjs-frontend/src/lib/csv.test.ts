import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
    it("starts with a byte-order mark, quotes what needs quoting and leaves numbers alone", () => {
        expect(toCsv(["Tên", "Cân (kg)"], [["Lê, \"Nam\"", 61.2], ["Kenji", null]])).toBe('﻿Tên,Cân (kg)\r\n"Lê, ""Nam""",61.2\r\nKenji,\r\n');
    });

    it("defuses cells a spreadsheet would run as a formula, but not negative numbers", () => {
        expect(toCsv(["a", "b"], [["=SUM(A1)", -2]])).toBe("﻿a,b\r\n'=SUM(A1),-2\r\n");
    });
});
