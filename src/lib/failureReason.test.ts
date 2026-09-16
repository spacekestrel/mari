import { describe, expect, it } from "vitest";
import { failureReason, isMissing } from "./failureReason";

describe("failureReason", () => {
  it("takes the message off an Error", () => {
    expect(failureReason(new Error("No such file or directory"))).toBe("No such file or directory");
  });

  it("reads a thrown string, which is what the fs plugin rejects with", () => {
    expect(failureReason("forbidden path: /etc/shadow")).toBe("forbidden path: /etc/shadow");
  });

  it("says nothing rather than something useless", () => {
    // `String({})` is "[object Object]", which tells a writer precisely nothing.
    expect(failureReason({})).toBe("");
    expect(failureReason(undefined)).toBe("");
    expect(failureReason(null)).toBe("");
    expect(failureReason(new Error("   "))).toBe("");
  });

  it("shortens a reason too long to read", () => {
    const long = failureReason(new Error("x".repeat(200)));
    expect(long).toHaveLength(90);
    expect(long.endsWith("…")).toBe(true);
  });

  it("leaves a reason that already fits alone", () => {
    const exact = "y".repeat(90);
    expect(failureReason(new Error(exact))).toBe(exact);
  });
});

describe("isMissing", () => {
  // The exact sentence the file system gave when a folder had been renamed,
  // taken from the real failure rather than written from memory.
  const linux =
    "failed to read directory at path: /home/writer/Books/My books with error: No such file or directory (os error 2)";

  it("knows a folder that has been moved or renamed", () => {
    expect(isMissing(linux)).toBe(true);
    expect(isMissing(new Error(linux))).toBe(true);
  });

  it("knows it on Windows too", () => {
    expect(isMissing("The system cannot find the path specified. (os error 3)")).toBe(true);
    expect(isMissing("The system cannot find the file specified. (os error 2)")).toBe(true);
  });

  it("knows the browser's version", () => {
    const notFound = new Error("A requested file or directory could not be found");
    notFound.name = "NotFoundError";
    expect(isMissing(notFound)).toBe(true);
  });

  it("does not mistake a real fault for a missing folder", () => {
    // "os error 20" contains "os error 2". It means the path is a file, not a
    // folder, which is a different problem and must not be quietly reworded.
    expect(isMissing("Not a directory (os error 20)")).toBe(false);
    expect(isMissing("Permission denied (os error 13)")).toBe(false);
    expect(isMissing("forbidden path: /etc/shadow")).toBe(false);
    expect(isMissing(new Error("Too many open files (os error 24)"))).toBe(false);
  });

  it("treats nothing at all as a real fault rather than a missing folder", () => {
    expect(isMissing(undefined)).toBe(false);
    expect(isMissing(null)).toBe(false);
    expect(isMissing({})).toBe(false);
  });
});
