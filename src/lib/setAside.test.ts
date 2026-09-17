import { describe, expect, it } from "vitest";
import { fingerprint, resolveSetAside, type SetAsideWork } from "./setAside";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("fingerprint", () => {
  it("is the same for the same bytes", () => {
    expect(fingerprint(bytes(1, 2, 3))).toBe(fingerprint(bytes(1, 2, 3)));
  });

  it("changes when a single byte changes", () => {
    expect(fingerprint(bytes(1, 2, 3))).not.toBe(fingerprint(bytes(1, 2, 4)));
  });

  it("changes when the length changes", () => {
    expect(fingerprint(bytes(1, 2, 3))).not.toBe(fingerprint(bytes(1, 2, 3, 0)));
  });

  it("tells apart the same bytes in a different order", () => {
    expect(fingerprint(bytes(1, 2))).not.toBe(fingerprint(bytes(2, 1)));
  });

  it("handles an empty file", () => {
    expect(fingerprint(bytes())).toBe(fingerprint(bytes()));
    expect(fingerprint(bytes())).not.toBe(fingerprint(bytes(0)));
  });

  it("stays inside 32 bits however long the file is", () => {
    const long = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(fingerprint(long)).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
  });
});

describe("resolveSetAside", () => {
  const disk = bytes(10, 20, 30);
  const unsaved = bytes(10, 20, 30, 40);

  it("opens the file when nothing was set aside", () => {
    expect(resolveSetAside(disk, undefined)).toEqual({
      bytes: disk,
      restored: false,
      dropped: false,
    });
  });

  it("puts unsaved changes back when the file is untouched", () => {
    const waiting: SetAsideWork = { bytes: unsaved, base: fingerprint(disk) };
    expect(resolveSetAside(disk, waiting)).toEqual({
      bytes: unsaved,
      restored: true,
      dropped: false,
    });
  });

  it("drops them when the file has changed underneath", () => {
    // What a pull from another machine does.
    const waiting: SetAsideWork = { bytes: unsaved, base: fingerprint(bytes(1, 1, 1)) };
    expect(resolveSetAside(disk, waiting)).toEqual({
      bytes: disk,
      restored: false,
      dropped: true,
    });
  });

  it("drops work that never recorded what it was based on", () => {
    // Set aside by an older Mari. It cannot be shown to match, so it can't be
    // trusted over the file.
    const waiting: SetAsideWork = { bytes: unsaved, base: null };
    expect(resolveSetAside(disk, waiting)).toEqual({
      bytes: disk,
      restored: false,
      dropped: true,
    });
  });
});
