import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdownClient } from "@/lib/markdown/render-client";
import { readingTime as computeReadingTime, makeExcerpt } from "@/lib/markdown/pipeline";
import { slugify } from "@/lib/utils/slugify";

type Status = "draft" | "scheduled" | "published" | "archived";

export interface EditorInitial {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  status: Status;
  scheduled_for: string | null;
  published_at: string | null;
}

interface Props {
  initial: EditorInitial;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; text: string };

/**
 * Editor — side-by-side markdown + rendered preview. Manual save only
 * (Ctrl/⌘+S or the "Save draft" button); no autosave.
 */
export default function Editor({ initial }: Props) {
  const [meta, setMeta] = useState({
    title: initial.title,
    slug: initial.slug,
    excerpt: initial.excerpt,
    cover_image: initial.cover_image,
  });
  const [content, setContent] = useState(initial.content ?? "");
  const [scheduledFor, setScheduledFor] = useState(initial.scheduled_for ?? "");
  const [status, setStatus] = useState<Status>(initial.status);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [previewVersion, setPreviewVersion] = useState<"client" | "server">("client");

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const postIdRef = useRef<string | null>(initial.id);

  // live client-side preview
  const clientHtml = useMemo(() => renderMarkdownClient(content), [content]);

  // debounced server-rendered preview
  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!r.ok) return;
        const j = (await r.json()) as { html?: string };
        if (previewRef.current && typeof j.html === "string") {
          previewRef.current.innerHTML = j.html;
          setPreviewVersion("server");
        }
      } catch {
        /* fall back to client render silently */
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [content]);

  // scroll sync (editor → preview)
  useEffect(() => {
    const el = editorRef.current;
    const pv = previewRef.current;
    if (!el || !pv) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const pct = el.scrollTop / max;
      pv.scrollTop = pct * (pv.scrollHeight - pv.clientHeight);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Manual save only: "Save draft" button or Ctrl/Cmd+S. No autosave.

  async function persist(reason: "autosave" | "publish" | "schedule" | "draft"): Promise<void> {
    setSave({ kind: "saving" });
    try {
      const slug = meta.slug?.trim() || slugify(meta.title);
      const body = {
        title: meta.title,
        slug,
        excerpt: meta.excerpt || makeExcerpt(content, 200),
        content,
        cover_image: meta.cover_image || null,
        status: (reason === "publish" ? "published" : reason === "schedule" ? "scheduled" : status) as Status,
        // datetime-local returns "YYYY-MM-DDTHH:mm" with no TZ; pin as UTC so
        // the picker and saved value round-trip identically across browser offsets.
        scheduled_for: scheduledFor ? `${scheduledFor}:00Z` : null,
      };

      let res: Response;
      let savedSlug = body.slug;
      if (postIdRef.current) {
        res = await fetch(`/api/posts/${postIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Save failed (${res.status}): ${t}`);
      }
      const data = (await res.json()) as { id: string; slug: string };
      postIdRef.current = data.id;
      savedSlug = data.slug;

      setMeta((m) => ({ ...m, slug: savedSlug }));
      setStatus(body.status);
      setSave({ kind: "saved", at: Date.now() });

      if (reason === "publish" || reason === "schedule") {
        const next =
          reason === "publish" ? "published" : "scheduled";
        setStatus(next);
      }
    } catch (err) {
      setSave({ kind: "error", text: (err as Error).message });
    }
  }

  function onAction(kind: "publish" | "schedule" | "draft") {
    void persist(kind);
  }

  async function onDelete() {
    if (!postIdRef.current) return;
    if (!window.confirm("Delete this post permanently?")) return;
    const r = await fetch(`/api/posts/${postIdRef.current}`, { method: "DELETE" });
    if (r.ok) window.location.href = "/admin/posts";
    else window.alert(await r.text());
  }

  const minutes = computeReadingTime(content);

  return (
    <div className="stack gap-4">
      {/* Meta ------------------------------------------------- */}
      <div className="card stack gap-3" style={{ padding: "var(--sp-5)" }}>
        <div className="field">
          <label className="label">Title</label>
          <input
            className="input"
            value={meta.title}
            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            placeholder="The most important headline of your career"
          />
        </div>
        <div className="row gap-3" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--sp-3)" }}>
          <div className="field">
            <label className="label">Slug</label>
            <input
              className="input"
              value={meta.slug}
              onChange={(e) => setMeta({ ...meta, slug: e.target.value })}
              placeholder="auto-generated from title"
              spellCheck={false}
            />
            <span className="hint">/posts/{meta.slug || "(slug)"}</span>
          </div>
          <div className="field">
            <label className="label">Cover image</label>
            <input
              className="input"
              type="url"
              value={meta.cover_image}
              onChange={(e) => setMeta({ ...meta, cover_image: e.target.value })}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="field">
          <label className="label">Excerpt</label>
          <textarea
            className="textarea"
            style={{ minHeight: 60, fontFamily: "var(--serif)" }}
            value={meta.excerpt}
            onChange={(e) => setMeta({ ...meta, excerpt: e.target.value })}
            placeholder="Optional. Pulled automatically from the first paragraph if blank."
          />
        </div>
      </div>

      {/* Two-pane editor ------------------------------------- */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight: "70vh",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
          <div
            className="row between"
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-12)",
              background: "var(--bg-sunken)",
              color: "var(--muted)",
            }}
          >
            <span className="eyebrow" style={{ color: "var(--muted)" }}>EDITOR · Markdown/MDX</span>
            <span>⌘/Ctrl+S · save now</span>
          </div>
          <textarea
            ref={editorRef}
            className="thin-scroll"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void persist("autosave");
              }
            }}
            spellCheck={true}
            style={{
              flex: 1,
              width: "100%",
              border: 0,
              outline: "none",
              resize: "none",
              padding: "var(--sp-5)",
              background: "var(--surface-2)",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-14)",
              lineHeight: 1.6,
              color: "var(--ink)",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            className="row between"
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-12)",
              background: "var(--bg-sunken)",
              color: "var(--muted)",
            }}
          >
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              PREVIEW · {previewVersion === "server" ? "SSR pipeline" : "typing"}
            </span>
            <span>
              {minutes} min · {content.length} chars
            </span>
          </div>
          <div
            ref={previewRef}
            className="thin-scroll mdx-body preview-host"
            data-preview-host="true"
            style={{
              flex: 1,
              padding: "var(--sp-5)",
              overflowY: "auto",
              background: "var(--surface)",
            }}
            dangerouslySetInnerHTML={{ __html: clientHtml }}
          />
        </div>
      </div>

      {/* Status, schedule, actions --------------------------- */}
      <div className="card row between" style={{ padding: "var(--sp-4) var(--sp-5)", display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "center" }}>
        <div className="row gap-3" style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <span className={`pill pill--${status}`}>{
            status === "draft" ? "Draft" :
            status === "scheduled" ? "Scheduled" :
            status === "published" ? "Published" : "Archived"
          }</span>
          <span style={{ fontSize: "var(--fs-12)", color: "var(--muted)" }}>
            {save.kind === "idle" && "Unsaved · Ctrl/⌘+S or Save draft"}
            {save.kind === "saving" && "Saving…"}
            {save.kind === "saved" && `Saved · ${new Date(save.at).toLocaleTimeString()}`}
            {save.kind === "error" && (
              <span style={{ color: "var(--danger)" }}>Error: {save.text}</span>
            )}
          </span>
        </div>
        <div className="row gap-3" style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            className="input"
            value={scheduledFor ? scheduledFor.slice(0, 16) : ""}
            onChange={(e) => setScheduledFor(e.target.value.slice(0, 16))}
            style={{ width: 220, fontFamily: "var(--mono)", fontSize: "var(--fs-12)" }}
          />
          <button
            className="btn btn--ghost"
            disabled={!scheduledFor}
            onClick={() => onAction("schedule")}
          >
            Schedule
          </button>
          <button className="btn btn--ghost" onClick={() => onAction("draft")}>
            Save draft
          </button>
          <button className="btn btn--primary" onClick={() => onAction("publish")}>
            Publish →
          </button>
          {postIdRef.current && (
            <button className="btn btn--danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
