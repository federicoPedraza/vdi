"use client";

import ParsersTable from "@/components/ParsersTable";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import CreateParserModal from "@/components/CreateParserModal";
// Project list/selection is fetched via Next API to use httpOnly cookie

export default function Home() {
  const schemaColorPalette: Array<string> = [
    "#ffffff",
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#14b8a6",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#d946ef",
    "#ec4899",
    "#f43f5e",
  ];
  const [partner, setPartner] = useState<{ name: string } | null>(null);
  const [settings, setSettings] = useState<{ provider: "openai" | "ollama" } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectPromptOpen, setProjectPromptOpen] = useState(false);
  const [createPromptOpen, setCreatePromptOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  const [projects, setProjects] = useState<Array<{ _id: string; name: string; slug?: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const projectMenuRef = useRef<HTMLDivElement | null>(null);

  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [deletingSchemaId, setDeletingSchemaId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" });
        const data = (await res.json()) as { partner: { name: string } | null; settings: { provider: "openai" | "ollama" } | null };
        if (!cancelled) {
          setPartner(data.partner);
          setSettings(data.settings);
        }
      } catch {
        if (!cancelled) {
          setPartner(null);
          setSettings(null);
        }
      }
      // Load projects
      try {
        const res = await fetch("/api/partner/projects", { method: "GET" });
        if (res.ok) {
          const data = (await res.json()) as { projects: Array<{ _id: string; name: string; slug?: string }>; activeProjectId: string | null };
          if (!cancelled) {
            setProjects(data.projects || []);
            setActiveProjectId(data.activeProjectId || "");
            // After login logic
            const count = (data.projects || []).length;
            if (count === 0) {
              setCreatePromptOpen(true);
            } else if (!data.activeProjectId) {
              if (count === 1) {
                // Auto select the only project
                try {
                  await fetch("/api/partner/projects/active", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId: (data.projects[0] as { _id: string })._id }),
                  });
                  setActiveProjectId((data.projects[0] as { _id: string })._id);
                } catch { /* ignore */ }
              } else {
                // Ask user which to join
                setProjectPromptOpen(true);
              }
            }
          }
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
          setActiveProjectId("");
        }
      } finally {
        if (!cancelled) setProjectsLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close project menu on outside click
  useEffect(() => {
    if (!projectMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!projectMenuRef.current) return;
      if (!projectMenuRef.current.contains(e.target as Node)) setProjectMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [projectMenuOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/signin";
    }
  };

  const providerLabel = settings?.provider === "openai" ? "OpenAI" : settings?.provider === "ollama" ? "Ollama" : undefined;
  const hasProjects = Array.isArray(projects) && projects.length > 0;
  const projectOptions = useMemo(() => (projects ?? []).map((p: { _id: string; name: string }) => ({ id: p._id, name: p.name })), [projects]);
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);
  const [schemasOpen, setSchemasOpen] = useState(false);
  const [schemas, setSchemas] = useState<Array<{ _id: string; name: string; key?: string; alias?: string; color?: string; definition: string }>>([]);
  const [schemaDraft, setSchemaDraft] = useState<{ name: string; alias: string; color: string; key: string; definition: string }>({ name: "", alias: "", color: "#ffffff", key: "", definition: "{\n  \"type\": \"object\"\n}" });
  const [createParserOpen, setCreateParserOpen] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3 p-4 fixed top-0 left-0 right-0 bg-black z-10">
        <span
          aria-hidden
          className="w-6 h-6 text-white"
          style={{
            WebkitMaskImage: `url(/svg/doodles/vdi-logo.svg)`,
            maskImage: `url(/svg/doodles/vdi-logo.svg)`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            backgroundColor: "currentColor",
          }}
        />
        <div className="flex flex-col items-start gap-2">
          <h2 className="text-lg font-bold tracking-tight">Octos Adapters</h2>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            {partner && (
              <button
                type="button"
                aria-label="Log out"
                onClick={handleLogout}
                className="w-2 h-2 text-white/50 hover:text-white"
              >
                <span
                  aria-hidden
                  className="block w-full h-full"
                  style={{
                    WebkitMaskImage: `url(/svg/doodles/close.svg)`,
                    maskImage: `url(/svg/doodles/close.svg)`,
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    backgroundColor: "currentColor",
                  }}
                />
              </button>
            )}
            <span className="truncate max-w-[60vw]">
              {partner?.name ?? ""}
            </span>
          </div>
          {/* Project selector - show nothing while loading; show compact name + icon when ready */}
          {projectsLoaded && hasProjects && (
            <div className="relative" ref={projectMenuRef}>
              <button
                type="button"
                className="flex items-center gap-2 text-white/80 text-sm hover:text-white"
                onClick={() => setProjectMenuOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={projectMenuOpen}
                title={activeProjectId ? projectOptions.find((p) => p.id === activeProjectId)?.name : "Select project"}
              >
                <span aria-hidden className="text-base leading-none select-none">
                  {projectMenuOpen ? "▾" : "▸"}
                </span>
                <span className="truncate max-w-[50vw]">
                  {projectOptions.find((p) => p.id === activeProjectId)?.name || "Select project"}
                </span>
              </button>
              {projectMenuOpen && (
                <div className="absolute z-20 mt-1 min-w-[220px] border border-white/20 bg-black/95 shadow-lg">
                  <ul role="listbox" className="max-h-64 overflow-auto">
                    {projectOptions.map((p) => (
                      <li key={p.id} role="option" aria-selected={p.id === activeProjectId}>
                        <button
                          type="button"
                          disabled={isSavingSchema}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 ${p.id === activeProjectId ? "text-white" : "text-white/80"}`}
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/partner/projects/active", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ projectId: p.id }),
                              });
                              if (res.ok) {
                                setActiveProjectId(p.id);
                                setProjectMenuOpen(false);
                              }
                            } catch { }
                          }}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                    <li role="option" aria-selected={false}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 text-white/90`}
                        onClick={() => {
                          setProjectMenuOpen(false);
                          setManageProjectsOpen(true);
                        }}
                      >
                        Manage projects…
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Top-right settings button */}
        <div className="ml-auto flex flex-col items-end justify-end gap-3">
          <div className="flex flex-row items-center justify-end gap-2 w-full">
            <span className="text-xs text-white/70 hidden sm:block" title="Model provider">
              {providerLabel}
            </span>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
              className="w-6 h-6 text-white/80 hover:text-white"
              title="Settings"
            >
              <span
                aria-hidden
                className="block w-full h-full"
                style={{
                  WebkitMaskImage: `url(/svg/doodles/secured.svg)`,
                  maskImage: `url(/svg/doodles/secured.svg)`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  backgroundColor: "currentColor",
                }}
              />
            </button>
          </div>
          <div className="flex flex-row items-center justify-end gap-2 w-full">
            {
              partner && (
                <span className="text-xs text-white/70 hidden sm:block" title="Model provider">
                  Schemas
                </span>
              )
            }
            <button
              type="button"
              aria-label="Schemas"
              onClick={async () => {
                setSchemasOpen(true);
                setIsLoadingSchemas(true);
                try {
                  const res = await fetch("/api/partner/schemas", { method: "GET" });
                  const data = await res.json();
                  setSchemas(Array.isArray(data.schemas) ? data.schemas : []);
                } catch {
                  setSchemas([]);
                } finally {
                  setIsLoadingSchemas(false);
                }
              }}
              className="w-6 h-6 text-white/80 hover:text-white"
              title="Schemas"
            >
              <span
                aria-hidden
                className="block w-full h-full"
                style={{
                  WebkitMaskImage: `url(/svg/doodles/code.svg)`,
                  maskImage: `url(/svg/doodles/code.svg)`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  backgroundColor: "currentColor",
                }}
              />
            </button>
            <button
              type="button"
              aria-label="Create parser"
              onClick={() => setCreateParserOpen(true)}
              className="w-6 h-6 text-white/80 hover:text-white"
              title="Create parser"
            >
              <span
                aria-hidden
                className="block w-full h-full"
                style={{
                  WebkitMaskImage: `url(/svg/doodles/plus.svg)`,
                  maskImage: `url(/svg/doodles/plus.svg)`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  backgroundColor: "currentColor",
                }}
              />
            </button>
          </div>
        </div>
      </div>
      <main className="min-h-screen bg-black">
        <section className="h-screen w-full flex items-center justify-center">
          <div className="w-full max-w-5xl px-4">
            <ParsersTable />
          </div>
        </section>
      </main>

      {/* Select Project Modal */}
      <Dialog open={projectPromptOpen} onOpenChange={setProjectPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select a project</DialogTitle>
            <DialogDescription>Choose which project to work on.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="project-select">Project</Label>
            <select
              id="project-select"
              className="bg-transparent border border-white/25 text-white text-sm rounded px-2 py-2 w-full"
              value={activeProjectId}
              onChange={async (e) => {
                const nextId = e.target.value;
                if (!nextId) return;
                if (nextId === "__manage__") {
                  setProjectPromptOpen(false);
                  setManageProjectsOpen(true);
                  return;
                }
                try {
                  const res = await fetch("/api/partner/projects/active", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId: nextId }),
                  });
                  if (res.ok) {
                    setActiveProjectId(nextId);
                    setProjectPromptOpen(false);
                  }
                } catch { }
              }}
            >
              <option value="">Select…</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__manage__">Manage projects…</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectPromptOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Modal */}
      <Dialog open={createPromptOpen} onOpenChange={setCreatePromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>
              No projects found. Create a new one to start organizing your schemas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input id="project-name" value={newProjectName} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewProjectName(e.target.value)} placeholder="MyEcommerce" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePromptOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const name = newProjectName.trim();
                if (!name) return;
                try {
                  const res = await fetch("/api/partner/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, makeActive: true }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    // refresh list
                    const r = await fetch("/api/partner/projects", { method: "GET" });
                    const pj = await r.json();
                    setProjects(pj.projects || []);
                    setActiveProjectId(data.projectId || pj.activeProjectId || "");
                    setCreatePromptOpen(false);
                    setNewProjectName("");
                  }
                } catch { }
              }}
              disabled={!newProjectName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialName={partner?.name ?? ""}
        initialProvider={settings?.provider ?? "ollama"}
        onUpdated={(next) => {
          setPartner((p) => (p ? { ...p, name: next.name } : p));
          setSettings({ provider: next.provider });
        }}
      />

      {/* Schemas Modal */}
      <Dialog open={schemasOpen} onOpenChange={setSchemasOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Schemas</DialogTitle>
            <DialogDescription>Manage schemas for the active project.</DialogDescription>
          </DialogHeader>
          {!activeProjectId ? (
            <div className="text-sm opacity-80">Select or create a project first.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-xs opacity-70">Existing schemas</div>
                <div className="max-h-72 overflow-auto">
                  {isLoadingSchemas ? (
                    <Spinner className="mx-auto w-full flex items-center justify-center" size={24} aria-label="Loading schemas" />
                  ) : schemas.length === 0 ? (
                    <div className="p-3 text-sm opacity-70">No schemas yet</div>
                  ) : (
                    <ul>
                      {schemas.map((s) => (
                        <li key={s._id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color || "#ffffff" }} />
                            <div className="text-sm">{s.alias || s.name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            { deletingSchemaId === s._id ? (
                              <Spinner size={16} aria-label="Deleting" />
                            ) : (
                              <>
                              </>
                            )}
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() => {
                                let defString: string;
                                if (typeof s.definition === "string") {
                                  try {
                                    defString = JSON.stringify(JSON.parse(s.definition), null, 2);
                                  } catch {
                                    defString = s.definition;
                                  }
                                } else {
                                  defString = JSON.stringify(s.definition ?? {}, null, 2);
                                }
                                setSchemaDraft({
                                  name: s.name,
                                  alias: s.alias || "",
                                  color: s.color || "#ffffff",
                                  key: s.key || "",
                                  definition: defString,
                                });
                              }}
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-300 underline disabled:opacity-50"
                              onClick={async () => {
                                setDeletingSchemaId(s._id);
                                try {
                                  const url = new URL("/api/partner/schemas", window.location.origin);
                                  url.searchParams.set("id", s._id);
                                  const res = await fetch(url.toString(), { method: "DELETE" });
                                  if (res.ok) {
                                    setSchemas((prev) => prev.filter((x) => x._id !== s._id));
                                  }
                                } catch { } finally {
                                  setDeletingSchemaId(null);
                                }
                              }}
                              disabled={deletingSchemaId === s._id}
                            >
                              Delete
                            </button>
                          </div>
                        </li>

                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-xs opacity-70">Add or edit schema</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1 col-span-2">
                    <Label htmlFor="schema-name">Name</Label>
                    <Input id="schema-name" value={schemaDraft.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemaDraft((d) => ({ ...d, name: e.target.value }))} placeholder="orders" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="schema-alias">Alias</Label>
                    <Input id="schema-alias" value={schemaDraft.alias} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemaDraft((d) => ({ ...d, alias: e.target.value }))} placeholder="Orders" />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="schema-color">Color</Label>
                    <div id="schema-color" className="flex flex-wrap gap-2 pt-1">
                      {schemaColorPalette.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Choose color ${c}`}
                          aria-pressed={schemaDraft.color === c}
                          onClick={() => setSchemaDraft((d) => ({ ...d, color: c }))}
                          className="w-6 h-6 rounded-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/70"
                          style={{ backgroundColor: c, boxShadow: schemaDraft.color === c ? "0 0 0 2px rgba(255,255,255,0.9)" : undefined }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1 col-span-2">
                    <Label htmlFor="schema-key">Key (optional)</Label>
                    <Input id="schema-key" value={schemaDraft.key} onChange={(e: ChangeEvent<HTMLInputElement>) => setSchemaDraft((d) => ({ ...d, key: e.target.value }))} placeholder="order" />
                  </div>
                  <div className="grid gap-1 col-span-2">
                    <Label htmlFor="schema-definition">Definition (JSON)</Label>
                    <textarea
                      id="schema-definition"
                      className="w-full h-56 bg-transparent border border-white/20 p-2 text-sm font-mono"
                      value={schemaDraft.definition}
                      onChange={(e) => setSchemaDraft((d) => ({ ...d, definition: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    disabled={isSavingSchema}
                    onClick={async () => {
                      if (!schemaDraft.name.trim()) return;
                      try {
                        setIsSavingSchema(true);
                        const res = await fetch("/api/partner/schemas", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: schemaDraft.name.trim(),
                            definition: schemaDraft.definition,
                            key: schemaDraft.key || undefined,
                            alias: schemaDraft.alias || undefined,
                            color: schemaDraft.color || "#ffffff",
                          }),
                        });
                        if (res.ok) {
                          const list = await (await fetch("/api/partner/schemas", { method: "GET" })).json();
                          setSchemas(Array.isArray(list.schemas) ? list.schemas : []);
                        }
                      } catch { } finally {
                        setIsSavingSchema(false);
                      }
                    }}
                  >
                    {isSavingSchema ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size={16} aria-label="Saving" />
                        Saving
                      </span>
                    ) : (
                      "Save schema"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Projects Modal */}
      <ManageProjectsModal
        isOpen={manageProjectsOpen}
        onClose={() => setManageProjectsOpen(false)}
        existingSlugs={(projects || []).map((p) => p.slug || "").filter(Boolean)}
        onCreated={async () => {
          const r = await fetch("/api/partner/projects", { method: "GET" });
          const pj = await r.json();
          setProjects(pj.projects || []);
          if (!activeProjectId && pj.activeProjectId) setActiveProjectId(pj.activeProjectId);
        }}
      />

      {/* Create Parser Modal */}
      <CreateParserModal
        isOpen={createParserOpen}
        onClose={() => setCreateParserOpen(false)}
        onCreated={async () => {
          // No-op: the parsers list auto-refreshes via Convex; if not, we could trigger a refresh
        }}
      />
    </>
  );
}

function ManageProjectsModal({
  isOpen,
  onClose,
  existingSlugs,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  existingSlugs: Array<string>;
  onCreated: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeSlug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

  const slug = normalizeSlug(name);
  const slugConflict = !!slug && existingSlugs.includes(slug);

  const submit = async () => {
    if (!name.trim() || slugConflict) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create");
      await onCreated();
      onClose();
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage projects</DialogTitle>
          <DialogDescription>Create new projects for organizing schemas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="mp-name">Project name</Label>
            <Input id="mp-name" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="MyEcommerce" disabled={saving} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="mp-slug">Slug (preview)</Label>
            <Input id="mp-slug" value={slug} readOnly disabled className="opacity-80" />
            {slugConflict && <div className="text-xs text-red-400">Slug already in use. Choose a different name.</div>}
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !name.trim() || slugConflict}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size={16} aria-label="Creating" />
                Creating
              </span>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsModal({
  isOpen,
  onClose,
  initialName,
  initialProvider,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialProvider: "openai" | "ollama";
  onUpdated: (v: { name: string; provider: "openai" | "ollama" }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [provider, setProvider] = useState<"openai" | "ollama">(initialProvider);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");

  // keep inputs in sync when opening with newer values
  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setProvider(initialProvider);
    // Also fetch freshest values for the modal and show a loading spinner while we do
    let cancelled = false;
    const load = async () => {
      try {
        setInitialLoading(true);
        const res = await fetch("/api/auth/me", { method: "GET" });
        const data = (await res.json()) as { partner: { name: string } | null; settings: { provider: "openai" | "ollama" } | null };
        if (!cancelled) {
          if (data.partner?.name) setName(data.partner.name);
          if (data.settings?.provider) setProvider(data.settings.provider);
          // We never populate the OpenAI key back into the UI for security; leave empty
        }
      } catch {
        // ignore, keep existing values
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isOpen, initialName, initialProvider]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/partner/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, provider, openaiKey: provider === "openai" ? openaiKey : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save settings");
      onUpdated({ name, provider });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Partner identity and AI provider</DialogDescription>
        </DialogHeader>
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Spinner size={24} aria-label="Loading settings" />
            <div className="text-sm opacity-80">Loading…</div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="partner-name">Partner name</Label>
                <Input id="partner-name" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Your company" disabled={saving} />
              </div>
              <div className="grid gap-2">
                <Label>AI Provider</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="provider"
                      checked={provider === "ollama"}
                      onChange={() => setProvider("ollama")}
                      disabled={saving}
                    />
                    Ollama
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="provider"
                      checked={provider === "openai"}
                      onChange={() => setProvider("openai")}
                      disabled={saving}
                    />
                    OpenAI
                  </label>
                </div>
              </div>
              {provider === "openai" && (
                <div className="grid gap-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    value={openaiKey}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    autoComplete="off"
                    disabled={saving}
                  />
                  <div className="text-xs opacity-70">Stored encrypted on the server. It is never shown again.</div>
                </div>
              )}
              {error && <div className="text-red-400 text-sm">{error}</div>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={submit} disabled={saving || !name.trim()}>
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} aria-label="Saving" />
                    Saving
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
