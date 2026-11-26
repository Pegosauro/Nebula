const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" });
const pad = (value: number) => String(value).padStart(2, "0");
const year = (date: Date) => String(date.getFullYear()).padStart(4, "0");
export const numericDate = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${year(date)}`;
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const noteDateFormats = {
  date: { token: "{{data}}", format: numericDate },
  "date-time": { token: "{{data_ora}}", format: (date: Date) => `${numericDate(date)} ${localTime(date)}` },
  "long-date": { token: "{{data_estesa}}", format: (date: Date) => `${pad(date.getDate())} ${monthName.format(date)} ${year(date)}` },
  time: { token: "{{ora}}", format: localTime },
};

export function resolveNoteDates(text: string, now: Date): string {
  let result = text;
  for (const { token, format } of Object.values(noteDateFormats)) result = result.replaceAll(token, format(now));
  return result;
}
