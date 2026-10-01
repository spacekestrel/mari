import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { announceIfSlow, SLOW_AFTER_MS } from "./slowLoad";

describe("announceIfSlow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("says nothing when the work finishes quickly", () => {
    const say = vi.fn();
    const done = announceIfSlow(say);
    // A local folder read, over in a few milliseconds.
    vi.advanceTimersByTime(20);
    done();
    vi.advanceTimersByTime(1000);
    expect(say).not.toHaveBeenCalled();
  });

  it("speaks up when the work drags on", () => {
    const say = vi.fn();
    announceIfSlow(say);
    vi.advanceTimersByTime(SLOW_AFTER_MS);
    expect(say).toHaveBeenCalledOnce();
  });

  it("stays quiet right up to the moment", () => {
    const say = vi.fn();
    announceIfSlow(say);
    vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
    expect(say).not.toHaveBeenCalled();
  });

  it("says it once, not once a tick", () => {
    const say = vi.fn();
    announceIfSlow(say);
    vi.advanceTimersByTime(SLOW_AFTER_MS * 10);
    expect(say).toHaveBeenCalledOnce();
  });

  it("can be told to wait a different length of time", () => {
    const say = vi.fn();
    announceIfSlow(say, 500);
    vi.advanceTimersByTime(499);
    expect(say).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(say).toHaveBeenCalledOnce();
  });

  it("is harmless to finish twice", () => {
    const say = vi.fn();
    const done = announceIfSlow(say);
    done();
    done();
    vi.advanceTimersByTime(1000);
    expect(say).not.toHaveBeenCalled();
  });
});
