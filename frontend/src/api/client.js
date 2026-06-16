/**
 * LuraStudy API client
 * All requests go through the Vite proxy → FastAPI backend
 */

const BASE = "/api/v1";

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {},
  };

  if (body && !(body instanceof FormData)) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    options.body = body;
  }

  const res = await fetch(`${BASE}${path}`, options);

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  return request("POST", "/documents/upload", form);
}

export async function listDocuments() {
  return request("GET", "/documents");
}

export async function getDocument(id) {
  return request("GET", `/documents/${id}`);
}

export async function deleteDocument(id) {
  return request("DELETE", `/documents/${id}`);
}

// ─── Study / Flashcards ───────────────────────────────────────────────────────

export async function generateFlashcards({ documentId, knowledgeBaseId, maxCards = 20 }) {
  const body = { max_cards: maxCards };
  if (documentId) body.document_id = documentId;
  if (knowledgeBaseId) body.knowledge_base_id = knowledgeBaseId;
  return request("POST", "/study/generate/flashcards", body);
}

export async function listDecks() {
  return request("GET", "/study/decks");
}

export async function getDeck(deckId) {
  return request("GET", `/study/decks/${deckId}`);
}

export async function deleteDeck(deckId) {
  return request("DELETE", `/study/decks/${deckId}`);
}

export async function updateFlashcardState(flashcardId, gotIt) {
  return request("PATCH", `/study/flashcards/${flashcardId}`, {
    got_it: gotIt,
  });
}

// ─── Knowledge Bases ──────────────────────────────────────────────────────────

export async function listKnowledgeBases() {
  return request("GET", "/knowledge-bases");
}

export async function getKnowledgeBase(id) {
  return request("GET", `/knowledge-bases/${id}`);
}

export async function createKnowledgeBase(name, documentIds = []) {
  return request("POST", "/knowledge-bases", { name, document_ids: documentIds });
}

export async function updateKnowledgeBase(id, { name, documentIds }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (documentIds !== undefined) body.document_ids = documentIds;
  return request("PATCH", `/knowledge-bases/${id}`, body);
}

export async function addDocumentToKnowledgeBase(kbId, documentId) {
  return request("POST", `/knowledge-bases/${kbId}/documents/${documentId}`);
}

export async function removeDocumentFromKnowledgeBase(kbId, documentId) {
  return request("DELETE", `/knowledge-bases/${kbId}/documents/${documentId}`);
}

export async function deleteKnowledgeBase(id) {
  return request("DELETE", `/knowledge-bases/${id}`);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  return request("GET", "/settings");
}

export async function updateSettings(updates) {
  return request("PATCH", "/settings", updates);
}

export async function testConnection(payload) {
  return request("POST", "/settings/test-connection", payload);
}
