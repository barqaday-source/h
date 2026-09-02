import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";

export function useRemoteData(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setState({ data: null, loading: false, error: new Error("Supabase غير مُعد") });
      return null;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error });
      return null;
    }
  }, dependencies);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}

export function RemoteState({ loading, error, empty = false, children }) {
  if (loading)
    return (
      <p className="px-5 py-6 text-center text-xs text-muted-foreground">جاري تحميل البيانات...</p>
    );
  if (error)
    return (
      <p className="mx-5 rounded-2xl border border-border bg-surface p-4 text-center text-xs leading-relaxed text-muted-foreground">
        {error.message}
      </p>
    );
  if (empty)
    return (
      <p className="px-5 py-6 text-center text-xs text-muted-foreground">
        لا توجد بيانات متاحة حالياً.
      </p>
    );
  return children;
}
