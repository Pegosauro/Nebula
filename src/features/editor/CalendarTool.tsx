import { AlignLeft, CalendarClock, Clock } from "lucide-react";
import type { EditorApi } from "./editorCommands";
import { ToolbarMenu } from "./ToolbarMenu";

const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" });
const pad = (value: number) => String(value).padStart(2, "0");
const year = (date: Date) => String(date.getFullYear()).padStart(4, "0");
const numericDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${year(date)}`;
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

function CalendarIcon({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5.25" width="17" height="15" rx="2.5" />
    <path d="M7.75 3.5v4m8.5-4v4M3.5 10h17" />
    <path d="M8 14h.01m4 0h.01m4 0h.01M8 17.15h.01m4 0h.01m4 0h.01" strokeWidth="2.05" />
  </svg>;
}

const formats = [
  { label: "GG/MM/AAAA", Icon: CalendarIcon, format: numericDate },
  { label: "GG/MM/AAAA HH:mm", Icon: CalendarClock, format: (date: Date) => `${numericDate(date)} ${localTime(date)}` },
  { label: "GG MMMM AAAA", Icon: AlignLeft, format: (date: Date) => `${pad(date.getDate())} ${monthName.format(date)} ${year(date)}` },
  { label: "HH:mm", Icon: Clock, format: localTime },
];

export function CalendarTool({ api }: { api: EditorApi | null }) {
  const insert = (format: (date: Date) => string) => api?.insert(format(new Date()));
  return <ToolbarMenu label="Formati di data e ora" icon={<CalendarIcon />}
    primary={{ label: "Inserisci data (GG/MM/AAAA)", run: () => insert(numericDate) }}
    items={formats.map(({ label, Icon, format }) => ({
      id: label,
      label,
      icon: <Icon size={18} aria-hidden="true" />,
      example: () => format(new Date()),
      run: () => insert(format),
    }))} />;
}
