// En-tête des fichiers Markdown du dossier contenu/ (synchro GitHub) :
//
// ---
// title: Akatsuki
// parent: roles
// position: 3
// revision: 4
// camps: [{"name":"Akatsuki","color":"#c0392b"}]
// ---
//
// Une clé par ligne. Les valeurs entre guillemets, crochets ou accolades sont lues en JSON,
// true / false / null et les nombres aussi ; le reste est du texte tel quel.

export type FrontValue = string | number | boolean | null | FrontValue[] | { [k: string]: FrontValue };
export type Front = Record<string, FrontValue>;

export function parseFrontmatter(src: string): { data: Front; body: string; raw: Record<string, string> } {
  const text = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { data: {}, body: text, raw: {} };
  const data: Front = {};
  const raw: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    if (!/^[a-z_][a-z0-9_]*$/i.test(key)) continue;
    raw[key] = line.slice(i + 1).trim();
    data[key] = parseValue(raw[key]);
  }
  return { data, body: text.slice(m[0].length).replace(/^\n+/, ''), raw };
}

function parseValue(raw: string): FrontValue {
  if (raw === '') return '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null' || raw === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (/^["[{]/.test(raw)) {
    try {
      return JSON.parse(raw) as FrontValue;
    } catch {
      return raw;
    }
  }
  if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

function formatValue(v: FrontValue): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    // Texte simple écrit tel quel ; sinon entre guillemets (JSON) pour être relu à l'identique.
    const plain = v !== '' && !/^[\s"'[{~#-]|[\n\r]|:\s|\s$|^(true|false|null|-?\d+(\.\d+)?)$/.test(v);
    return plain ? v : JSON.stringify(v);
  }
  return JSON.stringify(v);
}

export function stringifyFrontmatter(data: Front, body: string): string {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${formatValue(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '').replace(/\s+$/, '')}\n`;
}
