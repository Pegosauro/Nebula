import { useMemo } from "react";
import { withoutFrontmatter } from "../../domain/noteProperties";
import { useSettledValue } from "../../hooks/useSettledValue";

// Both editor footers use the same calculation, after a typing pause.
const stats = new Map<string, { source: string; words: number; characters: number }>();
export function useDocumentStats(path: string | undefined, content = "") {
  const settled = useSettledValue(content, path);
  return useMemo(() => {
    const key = path ?? "", cached = stats.get(key);
    if (cached?.source === settled) return cached;
    const body = withoutFrontmatter(settled);
    let words = 0;
    for (const _match of body.matchAll(/\S+/gu)) words++;
    const result = { source: settled, words, characters: body.length };
    if (stats.size >= 8) stats.delete(stats.keys().next().value!);
    stats.set(key, result);
    return result;
  }, [path, settled]);
}
