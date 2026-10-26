import { blockingApplication } from "./open-application";

describe("blockingApplication", () => {
  it("hides a second submit while a file is still open", () => {
    const open = blockingApplication([
      { id: "closed", status: "FAILED" },
      { id: "live", status: "SUBMITTED" },
    ]);
    expect(open?.id).toBe("live");
  });

  it("allows another submit after FAIL, REJECTED or ACTIVATED", () => {
    expect(
      blockingApplication([
        { id: "a", status: "FAILED" },
        { id: "b", status: "REJECTED" },
        { id: "c", status: "ACTIVATED" },
      ]),
    ).toBeNull();
  });
});
