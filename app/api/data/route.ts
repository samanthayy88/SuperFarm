import { cookies } from "next/headers";
import { SESSION_COOKIE, serverConfig, tokenValid } from "@/lib/server/auth";

/**
 * The whole dashboard is one JSON document in the `app_state` table (id "main"), with a version number
 * so that two devices saving at once cannot silently overwrite each other.
 * Only this server talks to the database, using a key the browser never sees.
 */
export const dynamic = "force-dynamic";

async function guard() {
  const cfg = serverConfig();
  if (!cfg) return { error: Response.json({ error: "not-configured" }, { status: 503 }) } as const;
  const store = await cookies();
  if (!tokenValid(cfg, store.get(SESSION_COOKIE)?.value)) {
    return { error: Response.json({ error: "locked" }, { status: 401 }) } as const;
  }
  return { cfg } as const;
}

const headers = (key: string, extra: Record<string, string> = {}) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  ...extra,
});

type Row = { data: unknown; version: number };

async function readRow(url: string, key: string): Promise<Row | null> {
  const res = await fetch(`${url}/rest/v1/app_state?id=eq.main&select=data,version`, { headers: headers(key), cache: "no-store" });
  if (!res.ok) throw new Error(`database read failed (${res.status})`);
  const rows = (await res.json()) as Row[];
  return rows[0] ?? null;
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  try {
    const row = await readRow(g.cfg.url, g.cfg.key);
    return Response.json({ data: row?.data ?? null, version: row?.version ?? 0 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: { data?: unknown; baseVersion?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.data || typeof body.data !== "object" || typeof body.baseVersion !== "number") {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const { url, key } = g.cfg;
  const next = body.baseVersion + 1;
  try {
    let saved: Row[];
    if (body.baseVersion === 0) {
      // first ever save: create the row, unless another device got there first
      const res = await fetch(`${url}/rest/v1/app_state`, {
        method: "POST",
        headers: headers(key, { Prefer: "return=representation,resolution=ignore-duplicates" }),
        body: JSON.stringify({ id: "main", data: body.data, version: next }),
      });
      if (!res.ok) throw new Error(`database write failed (${res.status})`);
      saved = (await res.json()) as Row[];
    } else {
      // only overwrite the version this device last saw or loaded
      const res = await fetch(`${url}/rest/v1/app_state?id=eq.main&version=eq.${body.baseVersion}`, {
        method: "PATCH",
        headers: headers(key, { Prefer: "return=representation" }),
        body: JSON.stringify({ data: body.data, version: next, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`database write failed (${res.status})`);
      saved = (await res.json()) as Row[];
    }
    if (saved.length > 0) return Response.json({ version: next });
    const current = await readRow(url, key);
    return Response.json({ error: "conflict", data: current?.data ?? null, version: current?.version ?? 0 }, { status: 409 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
