import { Check } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  defaultExternalLinkAppearance, externalLinkIcons, externalLinkTones, externalWebUrl,
  type ExternalLinkDraft, type ExternalLinkIcon, type ExternalLinkTone,
} from "../../domain/externalLinks";
import { EditorDialog } from "./EditorDialog";
import { externalIconMask, fillExternalLinkCard } from "./externalLinkCard";
import type { ExternalLinkMenu } from "./externalLinkEditing";

const icons = Object.entries(externalLinkIcons) as [ExternalLinkIcon, string][];
const tones = Object.entries(externalLinkTones) as [ExternalLinkTone, string][];

export function ExternalLinkPanel({ target, onSave, onClose }: {
  target: ExternalLinkMenu;
  onSave: (draft: ExternalLinkDraft) => boolean;
  onClose: () => void;
}) {
  const { draft, standalone } = target.link;
  const [appearance, setAppearance] = useState(() => draft.appearance ?? defaultExternalLinkAppearance(externalWebUrl(draft.address)!));
  const [error, setError] = useState("");
  const title = useRef<HTMLInputElement>(null);
  const address = useRef<HTMLInputElement>(null);
  const example = useRef<HTMLDivElement>(null);

  function updateExample() {
    if (!example.current) return;
    const label = title.current?.value.trim() || draft.label;
    const url = externalWebUrl(address.current?.value ?? "") ?? externalWebUrl(draft.address)!;
    fillExternalLinkCard(example.current, label, url, appearance);
  }

  useLayoutEffect(updateExample, [appearance]);

  function onInput() {
    if (error) setError("");
    updateExample();
  }

  return <EditorDialog title="Modifica collegamento" onClose={onClose} anchor={target.anchor} preferSide className="external-link-dialog">
    <form onSubmit={event => {
      event.preventDefault();
      const label = title.current?.value.trim() ?? "";
      const url = address.current?.value.trim() ?? "";
      if (!label || !externalWebUrl(url)) { setError("Inserisci il testo e un indirizzo HTTP o HTTPS valido."); return; }
      if (onSave({ label, address: url, appearance: standalone ? appearance : undefined })) onClose();
      else setError("Il collegamento è cambiato. Chiudi il menu e riaprilo.");
    }}>
      <div className="external-link-fields">
        <label className="editor-field">Testo
          <input autoFocus ref={title} defaultValue={draft.label} onInput={onInput} required />
        </label>
        <label className="editor-field">Indirizzo
          <input ref={address} type="url" defaultValue={draft.address} onInput={onInput} required spellCheck={false} />
        </label>
        {standalone && <>
          <fieldset className="editor-field"><legend>Icona</legend>
            <div className="external-link-icon-picker">
              {icons.map(([icon, label]) => <button type="button" key={icon} title={label} aria-label={label}
                aria-pressed={appearance.icon === icon} onClick={() => setAppearance(current => ({ ...current, icon }))}>
                <span className="external-link-picker-icon" style={{ "--external-link-mask": externalIconMask(icon) } as CSSProperties} aria-hidden="true" />
              </button>)}
            </div>
          </fieldset>
          <fieldset className="editor-field"><legend>Colore scheda</legend>
            <div className="external-link-tone-picker">
              {tones.map(([tone, label]) => <button type="button" key={tone} title={label} aria-label={label} data-tone={tone}
                aria-pressed={appearance.tone === tone} onClick={() => setAppearance(current => ({ ...current, tone }))}>
                {appearance.tone === tone && <Check size={15} aria-hidden="true" />}
              </button>)}
              <span>{externalLinkTones[appearance.tone]}</span>
            </div>
          </fieldset>
          <div ref={example} className="external-link-card-body external-link-example" aria-hidden="true" />
        </>}
        {error && <p className="editor-panel-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" className="button button-secondary" onClick={onClose}>Annulla</button>
        <button type="submit" className="button button-primary">Salva</button></footer>
    </form>
  </EditorDialog>;
}
