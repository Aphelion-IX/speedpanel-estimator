/** @vitest-environment jsdom */
// =============================================================================
// useAsyncResource / useStableIds -- the one piece of hook logic in this tree
// with real tests. Every store in src/pages/projects/ is built on this, so
// covering it here covers the shared behavior all of them rely on.
// =============================================================================
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAsyncResource, useStableIds } from "./useAsyncResource";

describe("useAsyncResource", () => {
  it("starts loading and resolves to the fetched data", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: ["a", "b"], error: null });
    const { result } = renderHook(() => useAsyncResource(fetcher, [], { initialData: [] as string[] }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("resets to initialData and surfaces the error on failure", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [], error: "boom" });
    const { result } = renderHook(() => useAsyncResource(fetcher, [], { initialData: ["seed"] }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["seed"]);
    expect(result.current.error).toBe("boom");
  });

  it("skips the fetch entirely when skip is true", () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useAsyncResource(fetcher, [], { initialData: [], skip: true, skipError: "not signed in" }));

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("not signed in");
  });

  it("reload() re-invokes the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 1, error: null });
    const { result } = renderHook(() => useAsyncResource(fetcher, [], { initialData: 0 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.reload(); });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("setData patches the cached data without a fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [1, 2], error: null });
    const { result } = renderHook(() => useAsyncResource(fetcher, [], { initialData: [] as number[] }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setData(prev => [...prev, 3]); });
    expect(result.current.data).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("useStableIds", () => {
  it("keeps the same array reference when contents are unchanged", () => {
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useStableIds(ids), { initialProps: { ids: ["a", "b"] } });
    const first = result.current;
    rerender({ ids: ["a", "b"] });
    expect(result.current).toBe(first);
  });

  it("returns a new reference when contents change", () => {
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useStableIds(ids), { initialProps: { ids: ["a"] } });
    const first = result.current;
    rerender({ ids: ["a", "b"] });
    expect(result.current).not.toBe(first);
    expect(result.current).toEqual(["a", "b"]);
  });
});
