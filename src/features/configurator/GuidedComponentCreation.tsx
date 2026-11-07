import { useEffect, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";
import type { Component, Configurator, Quantity } from "./model";
import { DefinitionDialog } from "./DefinitionList";
import { ConditionTreeEditor } from "./ConditionTreeEditor";
import { ComponentMeasureEditor } from "./ComponentMeasureEditor";
import { ComponentPropertiesEditor } from "./ComponentPropertiesEditor";
import { componentErrors } from "./definitionValidation";
import {
  commitGuidedComponent,
  firstInvalidGuidedStep,
  guidedProblems,
  guidedStepLabels,
  guidedStepProblems,
  guidedSteps,
  inclusionDescriptions,
  inclusionLabels,
  inclusionModes,
  newGuidedDraft,
  type GuidedDraft,
  type GuidedStep,
  type InclusionMode,
} from "./guidedComponent";

const stepHints: Record<GuidedStep, string> = {
  identity: "Bastano codice e descrizione. Dimensioni, proprietà e gli altri dati restano per dopo.",
  presence: "Scegli una modalità. Nessuna è selezionata in anticipo.",
  inclusion: "La quantità usa le stesse regole della distinta. Le condizioni si aggiungono solo se le chiedi.",
  catalog: "Gruppo, unità, famiglia e scheda sono facoltativi.",
  dimensions: "Facoltative. Il componente si può creare anche senza dimensioni.",
  properties: "Facoltative. Il componente si può creare anche senza proprietà.",
};

export function GuidedComponentCreation({ data, notes, onClose, onCreate }: { data: Configurator; notes: string[]; onClose: () => void; onCreate: (next: Configurator) => void }) {
  const [draft, setDraft] = useState(newGuidedDraft);
  const [step, setStep] = useState<GuidedStep>("identity");
  const [complete, setComplete] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const problems = complete ? guidedProblems(data, draft) : guidedStepProblems(data, draft, step);
  const visibleProblems = showErrors ? problems : [];
  const identityErrors = showErrors ? componentErrors(data, draft.component) : {};
  const finishLabel = "Crea componente";
  const primaryLabel = complete || step === "properties" ? finishLabel : "Avanti";
  const showEarlyCreate = !complete && step !== "identity" && step !== "presence" && step !== "properties";

  useEffect(() => {
    document.querySelector<HTMLElement>("dialog h3")?.focus();
  }, [step, complete]);
  useEffect(() => {
    if (!focusRequest) return;
    const root = document.querySelector("dialog");
    const field = root?.querySelector<HTMLElement>("input[aria-invalid='true'], textarea[aria-invalid='true'], select[aria-invalid='true']");
    const alert = root?.querySelector<HTMLElement>("[data-guided-error]");
    (field ?? alert)?.focus();
  }, [focusRequest]);

  const reveal = (next: GuidedStep) => {
    setShowErrors(true);
    if (!complete) setStep(next);
    setFocusRequest(value => value + 1);
  };
  const advance = () => {
    if (step === "identity" || step === "presence" || step === "dimensions" || step === "properties") {
      if (guidedStepProblems(data, draft, step).length) { reveal(step); return; }
    }
    setShowErrors(false);
    setStep(guidedSteps[Math.min(guidedSteps.length - 1, guidedSteps.indexOf(step) + 1)]!);
  };
  const create = () => {
    const invalid = firstInvalidGuidedStep(data, draft);
    if (invalid) { reveal(invalid); return; }
    onCreate(commitGuidedComponent(data, draft));
  };
  const back = () => { setShowErrors(false); setStep(guidedSteps[Math.max(0, guidedSteps.indexOf(step) - 1)]!); };
  const patchComponent = (patch: Partial<Component>) => setDraft(current => ({ ...current, component: { ...current.component, ...patch } }));
  const describedBy = (id: string, message?: string) => message ? id : undefined;

  const identity = <div className="config-fields">
    <label>Codice<input id="guided-code" aria-invalid={!!identityErrors.code} aria-describedby={describedBy("guided-code-error", identityErrors.code)} value={draft.component.code} onChange={event => patchComponent({ code: event.target.value })}/>{identityErrors.code && <small id="guided-code-error" className="config-field-error">{identityErrors.code}</small>}</label>
    <label className="config-grow">Descrizione<input id="guided-name" aria-invalid={!!identityErrors.name} aria-describedby={describedBy("guided-name-error", identityErrors.name)} value={draft.component.name} onChange={event => patchComponent({ name: event.target.value })}/>{identityErrors.name && <small id="guided-name-error" className="config-field-error">{identityErrors.name}</small>}</label>
  </div>;
  const presence = <InclusionChoice draft={draft} invalid={showErrors && !draft.mode} onChange={mode => setDraft(current => ({ ...current, mode }))}/>;
  const inclusion = <InclusionStep data={data} draft={draft} onDraft={setDraft}/>;
  const catalog = <div className="config-fields">
    <label>Gruppo / assieme<input aria-label="Gruppo" value={draft.component.group} onChange={event => patchComponent({ group: event.target.value })}/></label>
    <label>Unità<input aria-label="Unità" value={draft.component.unit} onChange={event => patchComponent({ unit: event.target.value })}/></label>
    <label>Famiglia<input aria-label="Famiglia" list="config-family-names" value={draft.component.family ?? ""} placeholder="Es. PROFILI o ACCESSORI" onChange={event => patchComponent({ family: event.target.value })}/></label>
    <label className="config-grow">Scheda tecnica (nota del Vault)<input aria-label="Scheda tecnica" list="config-note-paths" value={draft.component.note} placeholder="Es. Profili/PR001.md" onChange={event => patchComponent({ note: event.target.value })}/></label>
  </div>;
  const dimensions = <ComponentMeasureEditor data={data} component={draft.component} onChange={component => setDraft(current => ({ ...current, component }))}/>;
  const properties = <ComponentPropertiesEditor data={data} component={draft.component} onChange={component => setDraft(current => ({ ...current, component }))}/>;
  const sections: Record<GuidedStep, { title: string; body: ReactNode }> = {
    identity: { title: "Codice e descrizione", body: identity },
    presence: { title: "Quando entra in distinta", body: presence },
    inclusion: { title: "Inclusione", body: inclusion },
    catalog: { title: "Dati di catalogo", body: catalog },
    dimensions: { title: "Dimensioni", body: dimensions },
    properties: { title: "Proprietà", body: properties },
  };

  return <DefinitionDialog wide={complete || step === "inclusion" || step === "dimensions" || step === "properties"} draft={{ draft, step, complete }} title="Nuovo componente" description="La creazione resta in bozza finché non confermi. Annulla non aggiunge né il componente né regole." submitLabel={primaryLabel} onClose={onClose} onApply={primaryLabel === finishLabel ? create : advance} footerStart={<>
    {!complete && step !== "identity" && <button type="button" className="button button-secondary" onClick={back}>Indietro</button>}
    <button type="button" className="button button-secondary" onClick={() => { setComplete(value => !value); setShowErrors(false); }}>{complete ? "Torna alla guida" : "Modalità completa"}</button>
    {showEarlyCreate && <button type="button" className="button button-secondary" onClick={create}>{finishLabel}</button>}
  </>}>
    <div className="config-guided-form">
      <ol className="config-guided-steps" aria-label="Passi della creazione">{guidedSteps.map((item, index) => <li key={item} aria-current={!complete && item === step ? "step" : undefined}>{index + 1}. {guidedStepLabels[item]}</li>)}</ol>
      <p className="config-sr-only" role="status">{complete ? "Modalità completa" : `Passo ${guidedSteps.indexOf(step) + 1} di ${guidedSteps.length}: ${sections[step].title}`}</p>
      {complete && <p className="config-hint">Modalità completa: codice, presenza, inclusione, catalogo, dimensioni e proprietà sono tutti disponibili. Nessun campo oltre codice, descrizione e presenza è obbligatorio.</p>}
      {!!visibleProblems.length && <div id="guided-problems" className="config-error" role="alert" tabIndex={-1} data-guided-error>{visibleProblems.map(message => <p key={message}>{message}</p>)}</div>}
      {complete ? guidedSteps.map(item => <section key={item} aria-label={sections[item].title}><h3 tabIndex={-1}>{sections[item].title}</h3><p className="config-hint">{item === "inclusion" ? inclusionHint(draft.mode) : stepHints[item]}</p>{sections[item].body}</section>) : <section aria-label={sections[step].title}><h3 tabIndex={-1}>{sections[step].title}</h3><p className="config-hint">{step === "inclusion" ? inclusionHint(draft.mode) : stepHints[step]}</p>{sections[step].body}</section>}
      {notes.length === 0 && <span className="config-sr-only">Nessuna scheda disponibile.</span>}
    </div>
  </DefinitionDialog>;
}

function inclusionHint(mode: InclusionMode | undefined) {
  if (mode === "always") return "Inclusione incondizionata: il componente entra sempre in distinta, con la quantità indicata.";
  if (mode === "conditional") return "Nessuna condizione è preselezionata. Aggiungi e compila le condizioni che rendono vera l’inclusione.";
  if (mode === "catalog") return "Solo catalogo: confermando non viene creata nessuna regola di inclusione.";
  return "Scegli prima quando il componente entra in distinta.";
}

function InclusionChoice({ draft, invalid, onChange }: { draft: GuidedDraft; invalid: boolean; onChange: (mode: InclusionMode) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, mode: InclusionMode) => {
    const index = inclusionModes.indexOf(mode);
    const nextIndex = event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % inclusionModes.length
      : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index - 1 + inclusionModes.length) % inclusionModes.length
      : event.key === "Home" ? 0
      : event.key === "End" ? inclusionModes.length - 1
      : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const next = inclusionModes[nextIndex]!;
    onChange(next);
    event.currentTarget.form?.querySelector<HTMLInputElement>(`input[name="guided-inclusion"][value="${next}"]`)?.focus();
  };
  return <fieldset className="config-inclusion-choices" aria-invalid={invalid || undefined} aria-describedby={invalid ? "guided-mode-error" : undefined}>
    <legend className="config-sr-only">Quando il componente è presente</legend>
    {inclusionModes.map(mode => <label className="config-inclusion-choice" key={mode}>
      <input type="radio" name="guided-inclusion" value={mode} checked={draft.mode === mode} aria-describedby={`guided-mode-${mode}`} tabIndex={draft.mode ? draft.mode === mode ? 0 : -1 : mode === "always" ? 0 : -1} onChange={() => onChange(mode)} onKeyDown={event => onKeyDown(event, mode)}/>
      <span><strong>{inclusionLabels[mode]}</strong><small id={`guided-mode-${mode}`}>{inclusionDescriptions[mode]}</small></span>
    </label>)}
    {invalid && <small id="guided-mode-error" className="config-field-error">Scegli quando il componente entra in distinta.</small>}
  </fieldset>;
}

function InclusionStep({ data, draft, onDraft }: { data: Configurator; draft: GuidedDraft; onDraft: Dispatch<SetStateAction<GuidedDraft>> }) {
  if (!draft.mode) return <p className="config-hint">Torna al passo Presenza e scegli una modalità.</p>;
  if (draft.mode === "catalog") return <p>Nessuna regola verrà aggiunta. Il componente resta disponibile nel catalogo e non entra in distinta da solo.</p>;
  return <>
    {draft.mode === "conditional" && <ConditionTreeEditor explicitConditions emptyRootLabel="Nessuna condizione. Aggiungine una: non viene scelta al posto tuo." data={data} node={draft.expression} onChange={expression => onDraft(current => ({ ...current, expression }))}/>}
    <QuantityFields data={data} quantity={draft.quantity} onChange={quantity => onDraft(current => ({ ...current, quantity }))}/>
  </>;
}

function QuantityFields({ data, quantity, onChange }: { data: Configurator; quantity: Quantity; onChange: (quantity: Quantity) => void }) {
  const edit = (patch: Partial<Quantity>) => onChange({ ...quantity, ...patch });
  return <div className="config-quantity">
    <label>Quantità<input aria-label="Quantità" type="number" min="0" step="any" value={quantity.amount} onChange={event => edit({ amount: Number(event.target.value) })}/></label>
    <span>×</span>
    <label>Parametro<select aria-label="Parametro quantità" value={quantity.parameter ?? ""} onChange={event => edit({ parameter: event.target.value || undefined })}><option value="">Quantità fissa</option>{data.parameters.filter(parameter => parameter.type === "number").map(parameter => <option value={parameter.id} key={parameter.id}>{parameter.name}</option>)}</select></label>
    {quantity.parameter && <><span>÷</span><label>Divisore<input aria-label="Divisore" type="number" min="0.000001" step="any" value={quantity.divisor} onChange={event => edit({ divisor: Number(event.target.value) })}/></label><label>Arrotondamento<select aria-label="Arrotondamento" value={quantity.rounding} onChange={event => edit({ rounding: event.target.value as Quantity["rounding"] })}><option value="none">Nessuno</option><option value="ceil">Per eccesso</option><option value="floor">Per difetto</option></select></label></>}
  </div>;
}
