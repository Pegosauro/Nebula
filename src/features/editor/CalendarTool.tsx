import { AlignLeft, CalendarClock, Clock } from "lucide-react";
import type { EditorApi } from "./editorCommands";
import { ToolbarMenu } from "./ToolbarMenu";

import { noteDateFormats, numericDate } from "./noteDates";

function CalendarIcon({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5.25" width="17" height="15" rx="2.5" />
    <path d="M7.75 3.5v4m8.5-4v4M3.5 10h17" />
    <path d="M8 14h.01m4 0h.01m4 0h.01M8 17.15h.01m4 0h.01m4 0h.01" strokeWidth="2.05" />
  </svg>;
}

const formats = [
  { id: "date", Icon: CalendarIcon },
  { id: "date-time", Icon: CalendarClock },
  { id: "long-date", Icon: AlignLeft },
  { id: "time", Icon: Clock },
] as const;

export function CalendarTool({ api }: { api: EditorApi | null }) {
  return <ToolbarMenu label="Formati di data e ora" icon={<CalendarIcon />}
    primary={{ label: "Inserisci data (GG/MM/AAAA)", run: () => api?.insert(numericDate(new Date())) }}
    items={() => {
      const now = new Date();
      return formats.map(({ id, Icon }) => {
        const value = noteDateFormats[id].format(now);
        return { id, label: value, icon: <Icon size={18} aria-hidden="true" />, run: () => api?.insert(value) };
      });
    }} />;
}
