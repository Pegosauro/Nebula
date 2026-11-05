import { beforeEach, describe, expect, it } from "vitest";
import { quickSearchClient } from "./quickSearchClient";
import { indexWorkerClient } from "../knowledge/indexWorkerClient";
import { useSearchStore } from "./searchStore";

describe("searchStore", () => {
  beforeEach(async () => {
    localStorage.clear();
    useSearchStore.setState({ recentPaths: [] });
    useSearchStore.getState().reset();
    quickSearchClient.replace([{ path: "Alpha.md", title: "Alpha" }, { path: "Cartella/Beta.md", title: "Beta" }]);
    await indexWorkerClient.rebuild([
      { path: "Alpha.md", content: "# Alpha\n\nTesto con una galassia." },
      { path: "Cartella/Beta.md", content: "# Beta\n\nSeconda nota." },
    ]);
  });

  it("returns full-text results and clears an empty query", async () => {
    await useSearchStore.getState().search("galassia");
    expect(useSearchStore.getState().results.map((result) => result.path)).toEqual(["Alpha.md"]);

    await useSearchStore.getState().search("");
    expect(useSearchStore.getState().results).toEqual([]);
  });

  it("boosts recent notes in an empty Quick Switcher", async () => {
    useSearchStore.getState().recordOpen("Cartella/Beta.md");
    await useSearchStore.getState().searchQuick("");
    expect(useSearchStore.getState().quickResults[0]?.path).toBe("Cartella/Beta.md");
  });
});
