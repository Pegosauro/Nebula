const widthSuffix = /(?:^| \| )nebula-width=([1-9]\d{0,3})$/;

export function imageWidth(title: string | null | undefined): number | undefined {
  const match = title?.match(widthSuffix);
  return match ? Number(match[1]) : undefined;
}

export function titleWithImageWidth(title: string, width: number): string {
  const caption = title.replace(widthSuffix, "");
  return `${caption ? `${caption} | ` : ""}nebula-width=${width}`;
}

export function applyImageWidth(image: HTMLImageElement, width: string | number | undefined): void {
  if (width !== undefined && /^[1-9]\d{0,3}$/.test(String(width))) image.setAttribute("width", String(width));
}
