import React, { useEffect, useRef, useState } from "react";
import readmeContent from "../../README.md?raw";
import {
  getSettings,
  updateSettings,
  testConnection,
  createInvite,
  listInvites,
  revokeInvite,
  listUsers,
  updateUser,
  blockUser,
  unblockUser,
  deleteUser,
} from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { applyTheme, DEFAULT_THEME, LIGHT_THEME, THEME_LABELS, FONT_OPTIONS } from "../theme.js";
import "./SettingsPage.css";

const OLLAMA_BASE_URL = "http://host.docker.internal:11434/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

export default function SettingsPage() {
  const { user } = useAuth();

  const TABS = [
    { id: "ai-connections", label: "AI Connections", icon: "🔌" },
    ...(user?.is_admin ? [{ id: "admin", label: "Admin", icon: "🛡" }] : []),
    { id: "appearance",     label: "Appearance",     icon: "🎨" },
    { id: "about",          label: "About",           icon: "ℹ️" },
  ];

  const [activeTab, setActiveTab] = useState("ai-connections");

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>⚙ Settings</h1>
      </div>

      <div className="settings-layout">
        {/* ── Vertical tab list ── */}
        <nav className="settings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab-btn${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Tab content panel ── */}
        <div className="settings-content">
          {activeTab === "ai-connections" && <AiConnectionsTab />}
          {activeTab === "admin"          && <AdminTab />}
          {activeTab === "appearance"     && <AppearanceTab />}
          {activeTab === "about"          && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   AI Connections Tab
───────────────────────────────────────────────────────────────────────────── */
function AiConnectionsTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("");

  const [embBaseUrl, setEmbBaseUrl] = useState("");
  const [embApiKey, setEmbApiKey] = useState("");
  const [embModel, setEmbModel] = useState("");
  const [embDimensions, setEmbDimensions] = useState("");

  const [llmTestResult, setLlmTestResult] = useState(null);
  const [embTestResult, setEmbTestResult] = useState(null);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingEmb, setTestingEmb] = useState(false);

  useEffect(() => {
    getSettings()
      .then((data) => {
        setSettings(data);
        setLlmBaseUrl(data.llm_base_url);
        setLlmApiKey(data.llm_api_key);
        setLlmModel(data.llm_model);
        setEmbBaseUrl(data.embedding_base_url);
        setEmbApiKey(data.embedding_api_key);
        setEmbModel(data.embedding_model);
        setEmbDimensions(String(data.embedding_dimensions));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await updateSettings({
        llm_base_url: llmBaseUrl,
        llm_api_key: llmApiKey,
        llm_model: llmModel,
        embedding_base_url: embBaseUrl,
        embedding_api_key: embApiKey,
        embedding_model: embModel,
        embedding_dimensions: parseInt(embDimensions, 10) || undefined,
      });
      setSettings(updated);
      setSuccessMsg("Settings saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestLlm() {
    setTestingLlm(true);
    setLlmTestResult(null);
    try {
      const result = await testConnection({
        type: "llm",
        base_url: llmBaseUrl,
        api_key: llmApiKey,
        model: llmModel,
      });
      setLlmTestResult(result);
    } catch (e) {
      setLlmTestResult({ success: false, message: e.message });
    } finally {
      setTestingLlm(false);
    }
  }

  async function handleTestEmb() {
    setTestingEmb(true);
    setEmbTestResult(null);
    try {
      const result = await testConnection({
        type: "embedding",
        base_url: embBaseUrl,
        api_key: embApiKey,
        model: embModel,
      });
      setEmbTestResult(result);
    } catch (e) {
      setEmbTestResult({ success: false, message: e.message });
    } finally {
      setTestingEmb(false);
    }
  }

  function applyPreset(target, preset) {
    if (target === "llm") {
      if (preset === "ollama") {
        setLlmBaseUrl(OLLAMA_BASE_URL);
        setLlmApiKey("ollama");
        setLlmModel("llama3.2");
      } else if (preset === "openai") {
        setLlmBaseUrl(OPENAI_BASE_URL);
        setLlmApiKey("");
        setLlmModel("gpt-4o-mini");
      }
    } else {
      if (preset === "ollama") {
        setEmbBaseUrl(OLLAMA_BASE_URL);
        setEmbApiKey("ollama");
        setEmbModel("nomic-embed-text");
        setEmbDimensions("768");
      } else if (preset === "openai") {
        setEmbBaseUrl(OPENAI_BASE_URL);
        setEmbApiKey("");
        setEmbModel("text-embedding-3-small");
        setEmbDimensions("1536");
      }
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner" />Loading settings…
      </div>
    );
  }

  return (
    <>
      <div className="tab-title-row">
        <h2>🔌 AI Connections</h2>
        <p className="tab-desc">
          Configure the AI models used for flashcard generation and document embedding.
          Changes take effect immediately — no restart needed.
        </p>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}
      {successMsg && (
        <div className="banner banner-success">
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form">

        {/* ─── LLM Section ─────────────────────────────────────────────────── */}
        <section className="settings-section card">
          <div className="section-header">
            <div>
              <h3>🤖 Inference Model</h3>
              <p className="section-desc">Used to generate flashcards from your documents.</p>
            </div>
            <div className="preset-buttons">
              <span className="preset-label">Quick preset:</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => applyPreset("llm", "ollama")}
              >
                🦙 Ollama
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => applyPreset("llm", "openai")}
              >
                ✦ OpenAI
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="llm-base-url">Base URL</label>
              <input
                id="llm-base-url"
                type="text"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                placeholder="http://host.docker.internal:11434/v1"
                className="form-input"
              />
              <span className="form-hint">OpenAI-compatible endpoint</span>
            </div>

            <div className="form-group">
              <label htmlFor="llm-api-key">API Key</label>
              <input
                id="llm-api-key"
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                placeholder="ollama  /  sk-..."
                className="form-input"
              />
              <span className="form-hint">Use "ollama" for local Ollama</span>
            </div>

            <div className="form-group form-group-wide">
              <label htmlFor="llm-model">Model Name</label>
              <input
                id="llm-model"
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="llama3.2  /  gpt-4o-mini  /  mistral"
                className="form-input"
              />
              <span className="form-hint">
                Ollama examples: llama3.2, mistral, gemma3 · OpenAI: gpt-4o-mini, gpt-4o
              </span>
            </div>
          </div>

          <div className="test-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestLlm}
              disabled={testingLlm}
            >
              {testingLlm ? <><span className="spinner" />Testing…</> : "🔌 Test Connection"}
            </button>
            {llmTestResult && <TestResult result={llmTestResult} />}
          </div>
        </section>

        {/* ─── Embedding Section ───────────────────────────────────────────── */}
        <section className="settings-section card">
          <div className="section-header">
            <div>
              <h3>🔢 Embedding Model</h3>
              <p className="section-desc">
                Used to convert document text into vectors for semantic search.
                <strong> Note:</strong> changing this requires re-uploading existing documents.
              </p>
            </div>
            <div className="preset-buttons">
              <span className="preset-label">Quick preset:</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => applyPreset("embedding", "ollama")}
              >
                🦙 Ollama
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => applyPreset("embedding", "openai")}
              >
                ✦ OpenAI
              </button>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="emb-base-url">Base URL</label>
              <input
                id="emb-base-url"
                type="text"
                value={embBaseUrl}
                onChange={(e) => setEmbBaseUrl(e.target.value)}
                placeholder="http://host.docker.internal:11434/v1"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emb-api-key">API Key</label>
              <input
                id="emb-api-key"
                type="password"
                value={embApiKey}
                onChange={(e) => setEmbApiKey(e.target.value)}
                placeholder="ollama  /  sk-..."
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emb-model">Model Name</label>
              <input
                id="emb-model"
                type="text"
                value={embModel}
                onChange={(e) => setEmbModel(e.target.value)}
                placeholder="nomic-embed-text  /  text-embedding-3-small"
                className="form-input"
              />
              <span className="form-hint">
                Ollama: nomic-embed-text · OpenAI: text-embedding-3-small
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="emb-dimensions">Dimensions</label>
              <input
                id="emb-dimensions"
                type="number"
                value={embDimensions}
                onChange={(e) => setEmbDimensions(e.target.value)}
                placeholder="768"
                min="1"
                className="form-input"
              />
              <span className="form-hint">768 for nomic · 1536 for text-embedding-3-small</span>
            </div>
          </div>

          <div className="test-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestEmb}
              disabled={testingEmb}
            >
              {testingEmb ? <><span className="spinner" />Testing…</> : "🔌 Test Connection"}
            </button>
            {embTestResult && <TestResult result={embTestResult} />}
          </div>
        </section>

        {/* ─── Save button ─────────────────────────────────────────────────── */}
        <div className="settings-actions">
          <button type="submit" className="btn-primary btn-save" disabled={saving}>
            {saving ? <><span className="spinner" />Saving…</> : "💾 Save Settings"}
          </button>
        </div>
      </form>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Placeholder Tab
───────────────────────────────────────────────────────────────────────────── */
function PlaceholderTab({ title, icon, description }) {
  return (
    <>
      <div className="tab-title-row">
        <h2>{icon} {title}</h2>
        <p className="tab-desc">{description}</p>
      </div>
      <div className="placeholder-card card">
        <span className="placeholder-icon">{icon}</span>
        <p className="placeholder-label">Coming soon</p>
        <p className="placeholder-sub">This section is under construction.</p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Appearance Tab — color and font customization
───────────────────────────────────────────────────────────────────────────── */
const COLOR_KEYS = [
  "theme_bg",
  "theme_surface",
  "theme_surface_2",
  "theme_border",
  "theme_primary",
  "theme_primary_hover",
  "theme_success",
  "theme_warning",
  "theme_danger",
  "theme_text",
  "theme_text_muted",
];

const STORAGE_KEY = "lurastudy_theme_templates";

function AppearanceTab() {
  const [theme, setTheme] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getSettings()
      .then((data) => {
        const t = {};
        for (const key of COLOR_KEYS) {
          t[key] = data[key] || DEFAULT_THEME[key];
        }
        t.theme_font = data.theme_font || DEFAULT_THEME.theme_font;
        setTheme(t);
        applyTheme(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Load saved templates from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTemplates(JSON.parse(saved));
    } catch {}
  }, []);

  function handleColorChange(key, value) {
    const updated = { ...theme, [key]: value };
    setTheme(updated);
    applyTheme(updated);
  }

  function handleFontChange(value) {
    const updated = { ...theme, theme_font: value };
    setTheme(updated);
    applyTheme(updated);
  }

  function applyPreset(preset) {
    const t = { ...DEFAULT_THEME, ...preset };
    setTheme(t);
    applyTheme(t);
  }

  function saveTemplates(list) {
    setTemplates(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) {
      setError("Please enter a template name.");
      return;
    }
    const updated = [...templates, { name, theme: { ...theme } }];
    saveTemplates(updated);
    setTemplateName("");
    setSuccessMsg(`Template "${name}" saved!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function handleApplyTemplate(t) {
    setTheme(t.theme);
    applyTheme(t.theme);
    setSuccessMsg(`Template "${t.name}" applied!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function handleDeleteTemplate(name) {
    const updated = templates.filter((t) => t.name !== name);
    saveTemplates(updated);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lurastudy-theme.json";
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMsg("Theme exported!");
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        // Validate it looks like a theme
        const hasColors = COLOR_KEYS.some((k) => data[k]);
        const hasFont = data.theme_font;
        if (!hasColors && !hasFont) {
          setError("Invalid theme file. Expected theme_* keys.");
          return;
        }
        // Merge with current theme so partial imports work
        const merged = { ...theme, ...data };
        setTheme(merged);
        applyTheme(merged);
        setSuccessMsg("Theme imported successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
      } catch (err) {
        setError("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateSettings(theme);
      setSuccessMsg("Theme saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="tab-loading">
        <span className="spinner" />Loading theme…
      </div>
    );
  }

  return (
    <>
      <div className="tab-title-row">
        <h2>🎨 Appearance</h2>
        <p className="tab-desc">
          Customize colors and font to your liking. Changes preview instantly and
          are saved per user (follows you across devices).
        </p>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}
      {successMsg && (
        <div className="banner banner-success">✓ {successMsg}</div>
      )}

      {/* ── Presets ── */}
      <section className="settings-section card">
        <h3>🎯 Theme Presets</h3>
        <p className="section-desc">Quickly switch between pre-built themes.</p>
        <div className="appearance-presets">
          <button className="btn-secondary btn-sm" onClick={() => applyPreset(DEFAULT_THEME)}>
            🌙 Dark (Default)
          </button>
          <button className="btn-secondary btn-sm" onClick={() => applyPreset(LIGHT_THEME)}>
            ☀️ Light
          </button>
        </div>
      </section>

      {/* ── Colors ── */}
      <section className="settings-section card">
        <h3>🎨 Colors</h3>
        <p className="section-desc">
          Pick a color for each UI element. Click the color swatch to open the picker.
        </p>
        <div className="color-grid">
          {COLOR_KEYS.map((key) => (
            <div key={key} className="color-picker-group">
              <label className="color-picker-label" htmlFor={key}>
                {THEME_LABELS[key]}
              </label>
              <div className="color-picker-row">
                <input
                  id={key}
                  type="color"
                  className="color-input"
                  value={theme[key] || ""}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                />
                <input
                  type="text"
                  className="form-input color-hex-input"
                  value={theme[key] || ""}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Font ── */}
      <section className="settings-section card">
        <h3>🔤 Font</h3>
        <p className="section-desc">Choose a font family for the app interface.</p>
        <div className="appearance-font-row">
          <select
            className="form-input font-select"
            value={theme.theme_font || ""}
            onChange={(e) => handleFontChange(e.target.value)}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="form-input font-custom-input"
            placeholder="Or type a custom font-family…"
            value={theme.theme_font || ""}
            onChange={(e) => handleFontChange(e.target.value)}
          />
        </div>
      </section>

      {/* ── Templates ── */}
      <section className="settings-section card">
        <h3>💾 Theme Templates</h3>
        <p className="section-desc">
          Save your current configuration as a template to quickly switch between
          looks. Templates are stored in your browser (device-local).
        </p>

        {/* Save new template */}
        <div className="template-save-row">
          <input
            type="text"
            className="form-input template-name-input"
            placeholder="Template name…"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveTemplate()}
          />
          <button className="btn-primary btn-sm" onClick={handleSaveTemplate}>
            💾 Save Template
          </button>
        </div>

        {/* Saved template list */}
        {templates.length > 0 && (
          <div className="template-list">
            {templates.map((t) => (
              <div key={t.name} className="template-row">
                <span className="template-name">{t.name}</span>
                <div className="template-actions">
                  <button className="btn-secondary btn-sm" onClick={() => handleApplyTemplate(t)}>
                    Apply
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => handleDeleteTemplate(t.name)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {templates.length === 0 && (
          <p className="empty-state-text">No saved templates yet.</p>
        )}
      </section>

      {/* ── Import / Export ── */}
      <section className="settings-section card">
        <h3>📦 Import / Export</h3>
        <p className="section-desc">
          Export your current theme as a JSON file to share with others, or import
          a previously exported theme. The file includes all colors and font settings.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
        <div className="import-export-row">
          <button className="btn-secondary btn-sm" onClick={handleExport}>
            📤 Export Theme
          </button>
          <button className="btn-secondary btn-sm" onClick={handleImportClick}>
            📥 Import Theme
          </button>
        </div>
      </section>

      {/* ── Save ── */}
      <div className="settings-actions">
        <button className="btn-primary btn-save" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" />Saving…</> : "💾 Save Theme"}
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Admin Tab — invite management + user list
───────────────────────────────────────────────────────────────────────────── */
function AdminTab() {
  const { user: currentUser } = useAuth();
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [error, setError] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  useEffect(() => {
    listInvites()
      .then((data) => setInvites(data.invites || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingInvites(false));
    listUsers()
      .then((data) => setUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  async function refreshUsers() {
    try {
      const data = await listUsers();
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreateInvite() {
    setCreating(true);
    setError(null);
    try {
      const days = expiresInDays ? parseInt(expiresInDays, 10) : undefined;
      const invite = await createInvite(days);
      setInvites((prev) => [invite, ...prev]);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(token) {
    try {
      await revokeInvite(token);
      setInvites((prev) => prev.filter((i) => i.token !== token));
    } catch (e) {
      setError(e.message);
    }
  }

  function buildInviteUrl(token) {
    return `${window.location.origin}/register?invite=${token}`;
  }

  async function handleCopy(token) {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // fallback: select text
    }
  }

  async function handleToggleAdmin(u) {
    setError(null);
    try {
      await updateUser(u.id, { is_admin: !u.is_admin });
      await refreshUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleToggleBlock(u) {
    setError(null);
    try {
      if (u.is_blocked) {
        await unblockUser(u.id);
      } else {
        await blockUser(u.id);
      }
      await refreshUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteUser(u) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete user "${u.username}"?\n\nThis will also delete all of their documents, decks, flashcards, and knowledge bases. This action cannot be undone.`
    );
    if (!confirmed) return;
    setError(null);
    try {
      await deleteUser(u.id);
      await refreshUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="tab-title-row">
        <h2>🛡 Admin</h2>
        <p className="tab-desc">
          Manage invite tokens and view registered users.
        </p>
      </div>

      {error && (
        <div className="banner banner-error" onClick={() => setError(null)} style={{ cursor: "pointer" }}>
          ⚠ {error} <span style={{ float: "right", opacity: 0.6 }}>✕</span>
        </div>
      )}

      {/* ── Create Invite ── */}
      <section className="settings-section card">
        <h3>🔗 Create Invite Link</h3>
        <p className="section-desc">
          Generate a one-time invite link to share with a new user.
          The link opens the registration page with the token pre-filled.
        </p>
        <div className="admin-create-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="expires-days">Expires in (days)</label>
            <input
              id="expires-days"
              type="number"
              className="form-input"
              placeholder="Leave blank for no expiry"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min="1"
              max="365"
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleCreateInvite}
            disabled={creating}
            style={{ alignSelf: "flex-end" }}
          >
            {creating ? <><span className="spinner" />Creating…</> : "＋ Create Invite"}
          </button>
        </div>
      </section>

      {/* ── Invite List ── */}
      <section className="settings-section card">
        <h3>📋 Invite Tokens</h3>
        {loadingInvites ? (
          <div className="tab-loading"><span className="spinner" />Loading…</div>
        ) : invites.length === 0 ? (
          <p className="empty-state-text">No invite tokens yet.</p>
        ) : (
          <div className="admin-invite-list">
            {invites.map((inv) => (
              <div key={inv.token} className={`admin-invite-row${inv.is_used ? " used" : ""}`}>
                <div className="invite-info">
                  <code className="invite-token">{inv.token}</code>
                  <span className={`badge ${inv.is_used ? "badge-error" : "badge-ready"}`}>
                    {inv.is_used ? "Used" : "Available"}
                  </span>
                  {inv.expires_at && (
                    <span className="invite-meta">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="invite-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleCopy(inv.token)}
                  >
                    {copiedToken === inv.token ? "✓ Copied!" : "📋 Copy Link"}
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => handleRevoke(inv.token)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── User List ── */}
      <section className="settings-section card">
        <h3>👥 Registered Users</h3>
        {loadingUsers ? (
          <div className="tab-loading"><span className="spinner" />Loading…</div>
        ) : users.length === 0 ? (
          <p className="empty-state-text">No users found.</p>
        ) : (
          <div className="admin-user-list">
            {users.map((u) => (
              <div key={u.id} className={`admin-user-row${u.is_blocked ? " blocked" : ""}`}>
                <div className="admin-user-info">
                  <span className="user-name">{u.username}</span>
                  {u.email && <span className="user-email">{u.email}</span>}
                  {u.is_admin && <span className="badge badge-processing">Admin</span>}
                  {u.is_blocked && <span className="badge badge-error">Blocked</span>}
                  <span className="user-joined">
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="admin-user-actions">
                  {u.id !== currentUser?.id && (
                    <button
                      className={`btn-sm ${u.is_blocked ? "btn-secondary" : "btn-warning"}`}
                      onClick={() => handleToggleBlock(u)}
                      title={u.is_blocked ? "Unblock this user" : "Block this user"}
                    >
                      {u.is_blocked ? "🔓 Unblock" : "🔒 Block"}
                    </button>
                  )}
                  <button
                    className={`btn-sm ${u.is_admin ? "btn-warning" : "btn-secondary"}`}
                    onClick={() => handleToggleAdmin(u)}
                    title={u.is_admin ? "Remove admin privileges" : "Grant admin privileges"}
                  >
                    {u.is_admin ? "👑 Demote" : "👑 Make Admin"}
                  </button>
                  {u.id !== currentUser?.id && (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => handleDeleteUser(u)}
                      title="Delete this user and all their data"
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   About Tab — renders README.md content
───────────────────────────────────────────────────────────────────────────── */
function AboutTab() {
  const html = renderMarkdown(readmeContent);
  return (
    <>
      <div className="tab-title-row">
        <h2>ℹ️ About</h2>
        <p className="tab-desc">
          About LuraStudy — a local-first, self-hosted AI study assistant.
        </p>
      </div>
      <div
        className="about-content card"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

const _amp = "&" + "amp;";
const _lt = "&" + "lt;";
const _gt = "&" + "gt;";

/**
 * Minimal markdown to HTML renderer.
 * Handles everything used in LuraStudy's README.md.
 */
function renderMarkdown(md) {
  // Escape HTML entities
  let html = md
    .replace(/&/g, _amp)
    .replace(/</g, _lt)
    .replace(/>/g, _gt);

  // Code blocks (must be before other transformations)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = code
      .replace(new RegExp(_amp, "g"), "&")
      .replace(new RegExp(_lt, "g"), "<")
      .replace(new RegExp(_gt, "g"), ">");
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Horizontal rules (needs to be before headings due to ---)
  html = html.replace(/^---$/gm, "<hr />");

  // Headings
  html = html.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Bold and italic (must be before plain links)
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Tables: convert pipe-delimited rows into HTML tables
  const tableLines = html.split("\n");
  let inTable = false;
  let tableHtml = "";
  const processedLines = [];
  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      // Check if next line is a separator row
      const nextLine = tableLines[i + 1] || "";
      const isHeader = nextLine.trim().startsWith("|") && /^[\s:|:-]+$/.test(nextLine.trim());
      if (!inTable) {
        inTable = true;
        tableHtml = "<table>";
        if (isHeader) {
          const cells = parseTableRow(line);
          tableHtml += "<thead><tr>" + cells.map((c) => `<th>${c.trim()}</th>`).join("") + "</tr></thead>";
          i++; // skip separator row
        } else {
          tableHtml += "<tbody>";
          const cells = parseTableRow(line);
          tableHtml += "<tr>" + cells.map((c) => `<td>${c.trim()}</td>`).join("") + "</tr>";
        }
      } else {
        const cells = parseTableRow(line);
        tableHtml += "<tr>" + cells.map((c) => `<td>${c.trim()}</td>`).join("") + "</tr>";
      }
    } else {
      if (inTable) {
        inTable = false;
        if (!tableHtml.includes("</thead>")) tableHtml = tableHtml.replace("<tbody>", "");
        tableHtml += inTable ? "" : "</tbody></table>";
        processedLines.push(tableHtml);
        tableHtml = "";
      }
      processedLines.push(line);
    }
  }
  if (inTable) {
    if (!tableHtml.includes("</thead>")) tableHtml = tableHtml.replace("<tbody>", "");
    tableHtml += "</tbody></table>";
    processedLines.push(tableHtml);
  }
  html = processedLines.join("\n");

  // Unordered lists
  html = html.replace(/^(\s*)- (.*)$/gm, "<li>$2</li>");
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Line breaks (double newline = paragraph)
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // If already wrapped in a block-level tag, leave as-is
      if (/^<(?:h[1-6]|ul|ol|pre|table|hr|li)/.test(trimmed)) return trimmed;
      if (/^<(?:p|div|section)/.test(trimmed)) return trimmed;
      // Single lines that aren't paragraphs
      if (!trimmed.includes("\n") && /^<(?:code|strong|em|a)/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

function parseTableRow(line) {
  return line
    .split("|")
    .slice(1, -1) // remove leading/trailing empty from split
    .map((c) =>
      c
        .replace(new RegExp(_amp, "g"), "&")
        .replace(new RegExp(_lt, "g"), "<")
        .replace(new RegExp(_gt, "g"), ">")
    );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Test Result
───────────────────────────────────────────────────────────────────────────── */
function TestResult({ result }) {
  return (
    <div className={`test-result ${result.success ? "test-success" : "test-failure"}`}>
      <span className="test-icon">{result.success ? "✓" : "✗"}</span>
      <span className="test-message">{result.message}</span>
    </div>
  );
}
