import type { Configurator } from "./model";
const snapshots = new WeakMap<Configurator, string>();
/** Definitions are immutable. Badges, autosave and navigation share one
 * serialization instead of stringifying every project for every store update. */
export function serializeConfigurator(data: Configurator): string {
  let serialized = snapshots.get(data);
  if (serialized === undefined) { serialized = JSON.stringify(data); snapshots.set(data, serialized); }
  return serialized;
}
