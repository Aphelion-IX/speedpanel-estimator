// =============================================================================
// Shared async-resource hook -- the {data,loading,error}+load+reload pattern
// =============================================================================
// Every Supabase-backed store in this tree (useProjects, useProject,
// useOrdersSummary, useProjectActivity, useProjectsJourney,
// useProjectDocuments) was hand-rolling the same useState+useCallback+
// useEffect shape independently. This centralizes it: a fetcher returns
// {data, error} (never throws), the hook owns the loading/error state
// machine, and setData lets a mutator optimistically patch the cached data
// without waiting for a reload -- same behavior each store already had,
// just written once.
// =============================================================================
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface AsyncResourceState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export interface UseAsyncResourceOptions<T> {
  initialData: T;
  // Skip the fetch entirely (no supabase client configured, no signed-in
  // user yet, no id to fetch by, etc.) -- avoids the loading-then-empty
  // flash a real fetch-and-bail would otherwise cause.
  skip?: boolean;
  skipError?: string | null;
}

export interface AsyncResource<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T>>;
}

export function useAsyncResource<T>(
  fetcher: () => Promise<{ data: T; error: string | null }>,
  deps: unknown[],
  { initialData, skip = false, skipError = null }: UseAsyncResourceOptions<T>,
): AsyncResource<T> {
  const [state, setState] = useState<AsyncResourceState<T>>(() =>
    skip ? { data: initialData, loading: false, error: skipError } : { data: initialData, loading: true, error: null },
  );

  const load = useCallback(async () => {
    if (skip) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await fetcher();
    setState(error ? { data: initialData, loading: false, error } : { data, loading: false, error: null });
    // `deps` is the caller's own dependency list (the same values its
    // fetcher closure reads) -- this hook just forwards it to useCallback,
    // exactly the contract a hand-written useCallback would have.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps]);

  useEffect(() => { load(); }, [load]);

  const setData: Dispatch<SetStateAction<T>> = useCallback(updater => {
    setState(s => ({ ...s, data: typeof updater === "function" ? (updater as (prev: T) => T)(s.data) : updater }));
  }, []);

  return { data: state.data, loading: state.loading, error: state.error, reload: load, setData };
}

// Returns a referentially-stable array of ids -- only replaced when the
// contents actually differ, not merely because the caller's own array was
// reallocated this render. Lets a dependency list honestly include the
// array itself instead of a `.join(",")` proxy string.
export function useStableIds(ids: string[]): string[] {
  const ref = useRef(ids);
  const changed = ref.current.length !== ids.length || ref.current.some((id, i) => id !== ids[i]);
  if (changed) ref.current = ids;
  return ref.current;
}
