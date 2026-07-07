// Cron worker — flips due posts (status='scheduled' && scheduled_for <= now)
// to published. SUPABASE_SERVICE_ROLE_KEY bypasses RLS, so it's only in Worker secrets.

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

async function publishDuePosts(env: Env) {
  const url = `${env.SUPABASE_URL}/rest/v1/posts?status=eq.scheduled&scheduled_for=lte.${encodeURIComponent(
    new Date().toISOString(),
  )}&select=id,scheduled_for`;
  const r = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw new Error(`select failed: ${r.status} ${await r.text()}`);
  const due = (await r.json()) as { id: string; scheduled_for: string }[];
  if (due.length === 0) return { updated: 0 };

  // Issue N parallel PATCHes (one per row) so each row gets its own published_at
  // and the public list keeps its chronological order.
  await Promise.all(
    due.map((d) =>
      fetch(`${env.SUPABASE_URL}/rest/v1/posts?id=eq.${d.id}`, {
        method: "PATCH",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "published",
          published_at: d.scheduled_for,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error(`patch failed: ${r.status} ${r.statusText}`);
      }),
    ),
  );

  return { updated: due.length, ids };
}

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname !== "/run") {
      return jsonResp({ ok: false, error: "Not found. Use GET /run." }, 404);
    }
    try {
      const result = await publishDuePosts(env);
      return jsonResp({ ok: true, ...result });
    } catch (err) {
      return jsonResp({ ok: false, error: (err as Error).message }, 500);
    }
  },
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    try {
      const result = await publishDuePosts(env);
      console.log("[folio-cron]", JSON.stringify(result));
    } catch (err) {
      console.error("[folio-cron] failed", err);
    }
  },
};
