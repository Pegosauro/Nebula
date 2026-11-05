import { startTransition, useEffect, useState } from "react";

/** Nonessential derived UI waits for a short typing pause. The editable value
 * and persistence remain synchronous. A new document never shows the old one. */
export function useSettledValue<T>(value: T, scope: string | undefined, delay = 220): T {
  const [settled, setSettled] = useState({ value, scope });
  useEffect(() => {
    const timer = window.setTimeout(() => startTransition(() => setSettled({ value, scope })), delay);
    return () => window.clearTimeout(timer);
  }, [value, scope, delay]);
  return settled.scope === scope ? settled.value : value;
}
