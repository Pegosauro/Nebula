import type { ReactNode } from "react";

interface PanelHeaderProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PanelHeader({ title, eyebrow, actions }: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <div className="panel-heading">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {actions ? <div className="panel-actions">{actions}</div> : null}
    </header>
  );
}
