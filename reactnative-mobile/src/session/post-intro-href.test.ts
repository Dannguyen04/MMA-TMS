import { homeHrefForGate, postIntroHref, type SessionGate } from "@/session/session-context";

describe("postIntroHref", () => {
  it("returns null while session restore is still loading", () => {
    expect(postIntroHref("loading")).toBeNull();
  });

  it("sends anonymous users to login", () => {
    expect(postIntroHref("anonymous")).toBe("/login");
  });

  it("sends each role to its existing home", () => {
    const cases: Array<[SessionGate, string]> = [
      ["guest", "/ho-so"],
      ["fighter", "/"],
      ["coach", "/(coach)/fighters"],
      ["doctor", "/(doctor)"],
      ["admin", "/(admin)"],
    ];
    for (const [gate, href] of cases) {
      expect(postIntroHref(gate)).toBe(href);
      expect(homeHrefForGate(gate)).toBe(href);
    }
  });

  it("homeHrefForGate falls back to login while loading", () => {
    expect(homeHrefForGate("loading")).toBe("/login");
    expect(homeHrefForGate("anonymous")).toBe("/login");
  });
});
