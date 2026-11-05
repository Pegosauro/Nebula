const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const RESERVED_CHARACTERS = /[<>:"/\\|?*]/u;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu;

export class InvalidVaultPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidVaultPathError";
  }
}

export function normalizeRelativePath(input: string): string {
  const normalized = input.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new InvalidVaultPathError("Il percorso non può uscire dal Vault.");
  }

  if (segments.some((segment) => CONTROL_CHARACTERS.test(segment))) {
    throw new InvalidVaultPathError("Il percorso contiene caratteri non validi.");
  }

  return segments.join("/");
}

export function joinVaultPath(parent: string, name: string): string {
  return normalizeRelativePath(parent ? `${parent}/${name}` : name);
}

export function validateVaultEntryName(input: string): string {
  const name = input.trim();
  if (!name) throw new InvalidVaultPathError("Il nome non può essere vuoto.");
  if (name === "." || name === "..") throw new InvalidVaultPathError("Il nome non è valido.");
  if (name.length > 255) throw new InvalidVaultPathError("Il nome è troppo lungo.");
  if (CONTROL_CHARACTERS.test(name) || RESERVED_CHARACTERS.test(name)) {
    throw new InvalidVaultPathError("Il nome contiene caratteri non validi.");
  }
  if (/[. ]$/u.test(name)) throw new InvalidVaultPathError("Il nome non può terminare con un punto o uno spazio.");
  if (WINDOWS_RESERVED_NAME.test(name)) throw new InvalidVaultPathError("Questo nome è riservato dal sistema.");
  return name;
}

export function ensureMarkdownExtension(input: string): string {
  const name = validateVaultEntryName(input);
  return name.toLocaleLowerCase().endsWith(".md") ? name : `${name}.md`;
}

export function dirname(path: string): string {
  const normalized = normalizeRelativePath(path);
  const segments = normalized.split("/");
  segments.pop();
  return segments.join("/");
}

export function isPathInside(path: string, parent: string): boolean {
  const normalizedPath = normalizeRelativePath(path);
  const normalizedParent = normalizeRelativePath(parent);
  return normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}/`);
}

export function basename(path: string): string {
  const normalized = normalizeRelativePath(path);
  return normalized.split("/").at(-1) ?? "";
}

export function withoutMarkdownExtension(value: string): string {
  return value.replace(/\.md$/iu, "");
}

export function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex).toLocaleLowerCase() : "";
}
