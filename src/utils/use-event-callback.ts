import { useCallback, useEffect, useRef } from "react";

export function useEventCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);

  // we copy a ref to the callback scoped to the current state/props on each render
  useEffect(() => {
    ref.current = fn;
  });

  return useCallback<any>((...args: any) => ref.current.apply(null, args), []);
}
