import { useState } from "react";
import { isPaletteColor, paletteRows, paletteColorName, type PaletteColor } from "../../domain/colorPalette";

export function ColorPalette({ label, value, onChange, used }: {
  label: string;
  value?: string | null;
  onChange: (color: PaletteColor) => void;
  used?: ReadonlySet<string>;
}) {
  const [focused, setFocused] = useState<PaletteColor>();
  const tabStop = focused ?? (value && isPaletteColor(value) ? value : paletteRows[0].colors[0]);
  return <div className="color-palette" role="group" aria-label={label} onKeyDown={event => {
    const columns = paletteRows[0].colors.length;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (step === undefined) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const index = buttons.findIndex(button => button === event.target);
    if (index < 0) return;
    event.preventDefault();
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  }}>
    {paletteRows.map(row => <div className="color-palette-row" key={row.name}>
      <span className="color-palette-label" aria-hidden="true">{row.name}</span>
      {row.colors.map((color, index) => {
        const name = paletteColorName(row, index) + (used?.has(color) ? ", in uso" : "");
        return <button type="button" className="color-palette-swatch" key={color} aria-label={name} title={name}
          aria-pressed={value === color} tabIndex={tabStop === color ? 0 : -1} onFocus={() => setFocused(color)} style={{ backgroundColor: color }} onClick={() => onChange(color)} />;
      })}
    </div>)}
  </div>;
}
