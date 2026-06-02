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

export async function generateFlashcards(documentId, maxCards = 20) {
  return request("POST", "/study/generate/flashcards", {
    document_id: documentId,
    max_cards: maxCards,
  });
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
