import debounce from "lodash/debounce";
import { useEffect, useMemo, useState } from "react";

import { useEventCallback } from "./use-event-callback";
import { useIsMounted } from "./use-is-mounted";

// Note: React states that useMemo may release the cached function and recalculate on next render
// but I think it should be 99.9% safe to define the debounce function this way ...
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  timeout = 300
) => {
  const safeCallback = useEventCallback(callback);
  return useMemo(
    () => debounce(safeCallback, timeout),
    [safeCallback, timeout]
  );
};

export function useDebouncedValue<T>(
  value: T,
  timeout = 300,
  defaultValue = value
) {
  const isMounted = useIsMounted();
  const [val, setVal] = useState(defaultValue ?? value);
  const debouncedSetVal = useDebouncedCallback((v) => {
    if (isMounted() && v !== val) {
      setVal(v);
    }
  }, timeout);

  useEffect(() => {
    debouncedSetVal(value);
  }, [value, debouncedSetVal]);

  return val;
}
