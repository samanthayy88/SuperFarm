import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, clearFails, makeToken, passwordMatches, recordFail, serverConfig, tooManyTries } from "@/lib/server/auth";

export async function POST(request: Request) {
  const cfg = serverConfig();
  if (!cfg) return Response.json({ error: "not-configured" }, { status: 503 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooManyTries(ip)) return Response.json({ error: "Too many wrong tries. Wait 15 minutes and try again." }, { status: 429 });

  let password = "";
  try {
    password = String((await request.json()).password ?? "");
  } catch {
    // fall through with an empty password
  }
  if (!passwordMatches(cfg, password)) {
    recordFail(ip);
    await new Promise((r) => setTimeout(r, 700)); // makes guessing slower
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  clearFails(ip);
  const store = await cookies();
  store.set(SESSION_COOKIE, makeToken(cfg), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return Response.json({ ok: true });
}
