export function readableFileSystemError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof DOMException) {
    const messages: Record<string, string> = {
      NotAllowedError: "Nebula non dispone del permesso necessario per modificare il Vault.",
      SecurityError: "Il browser ha bloccato l'operazione per motivi di sicurezza.",
      NotFoundError: "Il file o la cartella non è più disponibile.",
      NoModificationAllowedError: "Il file o la cartella è protetto da modifiche.",
      InvalidModificationError: "L'operazione non può essere completata in questa posizione.",
      QuotaExceededError: "Lo spazio disponibile non è sufficiente per completare l'operazione.",
      TypeMismatchError: "Un file o una cartella con questo nome ha un tipo incompatibile.",
    };
    return messages[error.name] ?? error.message ?? "Operazione filesystem non riuscita.";
  }
  if (error instanceof Error) return error.message;
  return "Si è verificato un errore durante l'accesso al Vault.";
}
