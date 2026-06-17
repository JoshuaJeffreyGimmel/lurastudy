import React, { useEffect, useState } from "react";
import {
  getSettings,
  updateSettings,
  testConnection,
  createInvite,
  listInvites,
  revokeInvite,
  listUsers,
} from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
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
          {activeTab === "appearance"     && <PlaceholderTab title="Appearance"     icon="🎨" description="Theme and display customization options will be available here in a future update." />}
          {activeTab === "about"          && <PlaceholderTab title="About"           icon="ℹ️"  description="App version, changelog, and license information will be available here in a future update." />}
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
   Admin Tab — invite management + user list
───────────────────────────────────────────────────────────────────────────── */
function AdminTab() {
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
                  {!inv.is_used && (
                    <>
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
                    </>
                  )}
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
              <div key={u.id} className="admin-user-row">
                <span className="user-name">{u.username}</span>
                {u.email && <span className="user-email">{u.email}</span>}
                {u.is_admin && <span className="badge badge-processing">Admin</span>}
                <span className="user-joined">
                  Joined {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
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
