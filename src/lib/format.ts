const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const df = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dtf = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return 'à l’instant';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return 'le ' + df.format(new Date(iso));
}
export const date = (iso: string) => df.format(new Date(iso));
export const dateTime = (iso: string) => dtf.format(new Date(iso));
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`;
