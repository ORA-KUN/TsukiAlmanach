// Fonction « docs-sync » de l'Almanach (Supabase Edge Function, Deno).
// Reçoit les pages du dossier contenu/ du dépôt public ORA-KUN/TsukiAlmanach (action contenu.yml)
// et les passe à docs_git_sync() : publication si le fichier part de la version en ligne,
// sinon proposition à relire dans l'espace équipe. Rien n'est jamais effacé ni écrasé.
//
// Aucun secret partagé : l'action envoie un jeton OIDC signé par GitHub. On vérifie sa signature,
// qu'il est destiné à cette fonction, qu'il vient du dépôt (identifiant numérique), de sa branche
// principale et de l'action contenu.yml de cette branche. Tout autre appel est refusé.
//
// Installation : supabase functions deploy docs-sync --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';

const ISSUER = 'https://token.actions.githubusercontent.com';
const AUDIENCE = 'tsuki-almanach';
const REPO_ID = Deno.env.get('ALMANACH_REPO_ID') ?? '1447599920'; // ORA-KUN/TsukiAlmanach
const BRANCH = Deno.env.get('ALMANACH_BRANCH') ?? 'claude/project-thread-jhto3d';
const WORKFLOW = `/.github/workflows/contenu.yml@refs/heads/${BRANCH}`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Garde seulement la forme attendue ; la base revérifie tout de son côté.
function clean(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.spaces)) return null;
  const spaces = [];
  for (const s of o.spaces.slice(0, 200)) {
    if (!s || typeof s !== 'object') continue;
    const sp = s as Record<string, unknown>;
    const slug = String(sp.slug ?? '');
    if (!SLUG.test(slug) || slug.length > 60) continue;
    const pages = (Array.isArray(sp.pages) ? sp.pages : [])
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && SLUG.test(String((p as Record<string, unknown>).slug ?? '')))
      .filter((p) => typeof p.content !== 'string' || p.content.length <= 400_000)
      .slice(0, 500);
    spaces.push({ slug, ...(sp.meta && typeof sp.meta === 'object' ? { meta: sp.meta } : {}), pages });
  }
  return { author: String(o.author ?? 'Claude').slice(0, 60), spaces };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  const token = (req.headers.get('x-github-oidc') ?? '').trim();
  if (!token) return json({ error: 'Jeton GitHub manquant.' }, 401);
  let claims: Record<string, unknown>;
  try {
    ({ payload: claims } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE }));
  } catch {
    return json({ error: 'Jeton GitHub invalide.' }, 401);
  }
  if (String(claims.repository_id ?? '') !== REPO_ID) return json({ error: 'Dépôt non autorisé.' }, 403);
  if (String(claims.ref ?? '') !== `refs/heads/${BRANCH}` || !String(claims.workflow_ref ?? '').endsWith(WORKFLOW)) {
    return json({ error: 'Seule l’action contenu.yml de la branche principale peut envoyer des pages.' }, 403);
  }

  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > 20_000_000) return json({ error: 'Envoi trop lourd.' }, 413);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Requête illisible.' }, 400);
  }
  const payload = clean(body);
  if (!payload || !payload.spaces.length) return json({ info: 'Aucune page valable, rien à faire.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('docs_git_sync', { p: payload });
  if (error) return json({ error: `Enregistrement impossible : ${error.message}` }, 500);
  return json(data);
});
