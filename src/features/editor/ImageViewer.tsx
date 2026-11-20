import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { resolveImagePath } from "../../infrastructure/filesystem/vaultImages";
import { vaultService } from "../vault/vaultService";

export interface ImageToView { reference: string; alt: string }

export function ImageViewer({ image, sourcePath, onClose }: { image: ImageToView; sourcePath: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number }>(undefined);
  const anchor = useRef<{ x: number; y: number; left: number; top: number }>(undefined);
  const [source, setSource] = useState(/^https?:\/\//i.test(image.reference) ? image.reference : "");
  const [error, setError] = useState(false);
  const [fitWidth, setFitWidth] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (/^https?:\/\//i.test(image.reference)) return;
    let url = "", disposed = false;
    void (async () => {
      try {
        const blob = await vaultService.readImage(resolveImagePath(sourcePath, image.reference));
        if (!disposed) { url = URL.createObjectURL(blob); setSource(url); }
      } catch { if (!disposed) setError(true); }
    })();
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [image.reference, sourcePath]);

  function fit() {
    const img = picture.current, viewport = stage.current;
    if (img?.naturalWidth && viewport) setFitWidth(Math.min(img.naturalWidth, viewport.clientWidth, viewport.clientHeight * img.naturalWidth / img.naturalHeight));
  }

  function zoom(multiplier: number, at?: { x: number; y: number }) {
    const viewport = stage.current, img = picture.current;
    if (!viewport || !img?.naturalWidth || !fitWidth) return;
    const stageBox = viewport.getBoundingClientRect(), imageBox = img.getBoundingClientRect();
    const x = at?.x ?? stageBox.left + viewport.clientWidth / 2;
    const y = at?.y ?? stageBox.top + viewport.clientHeight / 2;
    const next = Math.max(.4, Math.min(8, Math.round(scale * multiplier * 100) / 100));
    if (next === scale) return;
    anchor.current = { x: (x - imageBox.left) / imageBox.width, y: (y - imageBox.top) / imageBox.height,
      left: x - stageBox.left, top: y - stageBox.top };
    setScale(next);
  }

  function reset() {
    anchor.current = undefined;
    stage.current?.scrollTo(0, 0);
    setScale(1);
  }

  function close() {
    dialog.current?.close();
    onClose();
  }

  useLayoutEffect(() => {
    const point = anchor.current, viewport = stage.current, img = picture.current;
    if (!point || !viewport || !img) return;
    anchor.current = undefined;
    const stageBox = viewport.getBoundingClientRect(), imageBox = img.getBoundingClientRect();
    viewport.scrollLeft += imageBox.left - stageBox.left + point.x * imageBox.width - point.left;
    viewport.scrollTop += imageBox.top - stageBox.top + point.y * imageBox.height - point.top;
  }, [scale]);
  useEffect(() => {
    const viewport = stage.current;
    if (!viewport) return;
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const viewport = stage.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, { x: event.clientX, y: event.clientY });
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [fitWidth, scale]);

  const name = image.alt || "Immagine";
  return <dialog ref={dialog} className="image-viewer" aria-label={`Anteprima immagine · ${name}`}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
    onKeyDown={event => {
      if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1.25); }
      if (event.key === "-") { event.preventDefault(); zoom(1 / 1.25); }
      if (event.key === "0") { event.preventDefault(); reset(); }
    }}>
    <div className="image-viewer-inner">
      <header>
        <strong title={name}>{name}</strong>
        <div role="group" aria-label="Zoom">
          <button type="button" className="button" aria-label="Riduci zoom" disabled={!fitWidth || scale <= .4} onClick={() => zoom(1 / 1.25)}><Minus size={17} /></button>
          <output aria-label="Livello di zoom">{Math.round(scale * 100)}%</output>
          <button type="button" className="button" aria-label="Aumenta zoom" disabled={!fitWidth || scale >= 8} onClick={() => zoom(1.25)}><Plus size={17} /></button>
          <button type="button" className="button" title="Adatta (0)" onClick={reset}>Adatta</button>
        </div>
        <button type="button" className="button" aria-label="Chiudi anteprima immagine" title="Chiudi (Esc)" onClick={close}><X size={19} /></button>
      </header>
      <div ref={stage} className="image-viewer-stage" aria-label="Immagine ingrandita" tabIndex={0}>
        <div className="image-viewer-content">
          {error ? <p role="alert">Immagine non disponibile.</p> : source
            ? <img ref={picture} src={source} alt={image.alt} referrerPolicy="no-referrer" draggable={false} onError={() => setError(true)}
                onLoad={fit} style={fitWidth ? { width: fitWidth * scale } : undefined}
                className={scale > 1 ? "is-zoomed" : undefined}
                onPointerDown={event => {
                  const viewport = stage.current;
                  if (!viewport || !event.isPrimary || event.button !== 0 || scale <= 1) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
                }}
                onPointerMove={event => {
                  const viewport = stage.current, start = drag.current;
                  if (!viewport || start?.id !== event.pointerId) return;
                  viewport.scrollLeft = start.left + start.x - event.clientX;
                  viewport.scrollTop = start.top + start.y - event.clientY;
                }}
                onLostPointerCapture={() => { drag.current = undefined; }} />
            : <p role="status">Caricamento immagine…</p>}
        </div>
      </div>
    </div>
  </dialog>;
}
