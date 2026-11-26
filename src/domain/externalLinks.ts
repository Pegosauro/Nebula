export const externalLinkIcons = {
  "link-esterno": "Link esterno",
  pdf: "PDF",
  excel: "Excel",
  word: "Word",
  powerpoint: "PowerPoint",
  cartella: "Cartella",
  immagine: "Immagine",
  video: "Video",
  "archivio-zip": "Archivio ZIP",
  download: "Download",
} as const;

export const externalLinkTones = {
  viola: "Viola", blu: "Blu", verde: "Verde", ambra: "Ambra", rosso: "Rosso", ardesia: "Ardesia",
} as const;

export type ExternalLinkIcon = keyof typeof externalLinkIcons;
export type ExternalLinkTone = keyof typeof externalLinkTones;
export type ExternalLinkAppearance = { icon: ExternalLinkIcon; tone: ExternalLinkTone };
export type ExternalLinkDraft = { label: string; address: string; appearance?: ExternalLinkAppearance };

const appearanceSuffix = /(?:^| )nebula-link:v1:([a-z-]+):([a-z-]+)$/u;

export function externalWebUrl(address: string): URL | undefined {
  const value = address.trim();
  if (!/^https?:\/\/[^/\s\\]/i.test(value)) return;
  try { return new URL(value); } catch { return; }
}

export function externalLinkTitle(title: string): { tooltip: string; appearance?: ExternalLinkAppearance } {
  const marker = appearanceSuffix.exec(title);
  const icon = marker?.[1] as ExternalLinkIcon | undefined;
  const tone = marker?.[2] as ExternalLinkTone | undefined;
  if (!marker || !icon || !tone || !Object.hasOwn(externalLinkIcons, icon) || !Object.hasOwn(externalLinkTones, tone)) return { tooltip: title };
  return { tooltip: title.slice(0, marker.index), appearance: { icon, tone } };
}

export function externalLinkTitleSuffix({ icon, tone }: ExternalLinkAppearance): string {
  return `nebula-link:v1:${icon}:${tone}`;
}

const fileAppearances: Record<string, ExternalLinkAppearance> = {
  pdf: { icon: "pdf", tone: "rosso" },
  xls: { icon: "excel", tone: "verde" }, xlsx: { icon: "excel", tone: "verde" },
  xlsm: { icon: "excel", tone: "verde" }, csv: { icon: "excel", tone: "verde" },
  doc: { icon: "word", tone: "blu" }, docx: { icon: "word", tone: "blu" },
  ppt: { icon: "powerpoint", tone: "ambra" }, pptx: { icon: "powerpoint", tone: "ambra" },
  zip: { icon: "archivio-zip", tone: "ardesia" }, "7z": { icon: "archivio-zip", tone: "ardesia" },
};

export function defaultExternalLinkAppearance(url: URL): ExternalLinkAppearance {
  const extension = url.pathname.split("/").at(-1)?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  if (Object.hasOwn(fileAppearances, extension)) return fileAppearances[extension]!;
  if (/^(?:png|jpe?g|webp|svg|gif|avif)$/u.test(extension)) return { icon: "immagine", tone: "viola" };
  if (/^(?:mp4|webm|mov|m4v)$/u.test(extension)) return { icon: "video", tone: "rosso" };
  return { icon: "link-esterno", tone: "viola" };
}
