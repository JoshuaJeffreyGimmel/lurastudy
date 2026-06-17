/**
 * LuraStudy API client
 * All requests go through the Vite proxy → FastAPI backend
 * Attaches JWT Bearer token from localStorage to every request.
 * On 401, clears the token and redirects to /login.
 */

const BASE = "/api/v1";

function getToken() {
  return localStorage.getItem("lurastudy_token");
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {},
  };

  const token = getToken();
  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }

  if (body && !(body instanceof FormData)) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    options.body = body;
  }

  const res = await fetch(`${BASE}${path}`, options);

  if (res.status === 401) {
    // Token expired or invalid — clear it and redirect to login
    localStorage.removeItem("lurastudy_token");
    localStorage.removeItem("lurastudy_user");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json(); // { access_token, token_type }
}

export async function register(username, password, email, inviteToken) {
  const body = { username, password };
  if (email) body.email = email;
  if (inviteToken) body.invite_token = inviteToken;
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json(); // UserResponse
}

export async function getMe() {
  return request("GET", "/auth/me");
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function createInvite(expiresInDays) {
  const query = expiresInDays ? `?expires_in_days=${expiresInDays}` : "";
  return request("POST", `/admin/invites${query}`);
}

export async function listInvites() {
  return request("GET", "/admin/invites");
}

export async function revokeInvite(token) {
  return request("DELETE", `/admin/invites/${token}`);
}

export async function listUsers() {
  return request("GET", "/admin/users");
}

export async function updateUser(userId, data) {
  return request("PATCH", `/admin/users/${userId}`, data);
}

export async function blockUser(userId) {
  return request("PATCH", `/admin/users/${userId}`, { is_blocked: true });
}

export async function unblockUser(userId) {
  return request("PATCH", `/admin/users/${userId}`, { is_blocked: false });
}

export async function deleteUser(userId) {
  return request("DELETE", `/admin/users/${userId}`);
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

export async function getDocumentChunks(id) {
  return request("GET", `/documents/${id}/chunks`);
}

// ─── Decks ────────────────────────────────────────────────────────────────────

export async function createDeck({ title, description }) {
  return request("POST", "/study/decks", { title, description });
}

export async function listDecks() {
  return request("GET", "/study/decks");
}

export async function getDeck(deckId) {
  return request("GET", `/study/decks/${deckId}`);
}

export async function updateDeck(deckId, { title, description }) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  return request("PATCH", `/study/decks/${deckId}`, body);
}

export async function deleteDeck(deckId) {
  return request("DELETE", `/study/decks/${deckId}`);
}

// ─── Deck Source Documents ────────────────────────────────────────────────────

export async function addDocumentToDeck(deckId, documentId) {
  return request("POST", `/study/decks/${deckId}/documents/${documentId}`);
}

export async function removeDocumentFromDeck(deckId, documentId) {
  return request("DELETE", `/study/decks/${deckId}/documents/${documentId}`);
}

// ─── Flashcard Generation ─────────────────────────────────────────────────────

export async function generateDeckFlashcards(deckId, maxCards = 20) {
  return request("POST", `/study/decks/${deckId}/generate`, { max_cards: maxCards });
}

// ─── Deck Chat ────────────────────────────────────────────────────────────────

export async function chatWithDeck(deckId, message, history = []) {
  return request("POST", `/study/decks/${deckId}/chat`, {
    message,
    history,
  });
}

// ─── Flashcard State ──────────────────────────────────────────────────────────

/** Legacy endpoint — kept for backward compatibility. */
export async function updateFlashcardState(flashcardId, gotIt) {
  return request("PATCH", `/study/flashcards/${flashcardId}`, {
    got_it: gotIt,
  });
}

/**
 * SM-2 review endpoint.
 * quality: 0–5
 *   5 = Easy (perfect recall)
 *   4 = Got It (correct with hesitation)
 *   1 = Again / Review Later (incorrect)
 */
export async function reviewFlashcard(flashcardId, quality) {
  return request("PATCH", `/study/flashcards/${flashcardId}/review`, {
    quality,
  });
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

/**
 * Generate a multiple-choice quiz from the deck's source documents.
 * Response: { deck_id, questions: [{ question, options, correct_index, explanation }] }
 */
export async function generateDeckQuiz(deckId, maxQuestions = 10) {
  return request("POST", `/study/decks/${deckId}/quiz`, { max_questions: maxQuestions });
}

// ─── Due Cards ────────────────────────────────────────────────────────────────

/**
 * Returns only the cards that are due today or overdue for a given deck.
 * Response: { deck_id, due_cards, due_count, total_count }
 */
export async function getDueCards(deckId) {
  return request("GET", `/study/decks/${deckId}/due`);
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

// ─── Chat Conversations (History) ────────────────────────────────────────────

/**
 * List all saved conversations for a deck.
 * Response: { conversations: [...], total }
 */
export async function listConversations(deckId) {
  return request("GET", `/history/decks/${deckId}/conversations`);
}

/**
 * Create a new conversation for a deck.
 * Response: { id, deck_id, title, created_at, updated_at, messages: [] }
 */
export async function createConversation(deckId, title = "New Chat") {
  return request("POST", `/history/decks/${deckId}/conversations`, { title });
}

/**
 * Load a conversation with all its messages.
 */
export async function getConversation(convId) {
  return request("GET", `/history/conversations/${convId}`);
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(convId) {
  return request("DELETE", `/history/conversations/${convId}`);
}

/**
 * Rename a conversation.
 */
export async function renameConversation(convId, title) {
  return request("PATCH", `/history/conversations/${convId}/title`, { title });
}

/**
 * Send a message in a conversation. Returns the AI reply message.
 * Response: { id, conversation_id, role: "assistant", content, created_at }
 */
export async function chatInConversation(convId, message) {
  return request("POST", `/history/conversations/${convId}/chat`, { message });
}

// ─── Quiz History ─────────────────────────────────────────────────────────────

/**
 * List all saved quizzes for a deck.
 * Response: { quizzes: [...], total }
 */
export async function listQuizHistory(deckId) {
  return request("GET", `/history/decks/${deckId}/quizzes`);
}

/**
 * Save a newly generated quiz to the database.
 * Response: { id, deck_id, title, questions, created_at, attempts: [] }
 */
export async function saveQuiz(deckId, title, questions) {
  return request("POST", `/history/decks/${deckId}/quizzes`, { title, questions });
}

/**
 * Load a saved quiz with all its attempts.
 */
export async function getQuiz(quizId) {
  return request("GET", `/history/quizzes/${quizId}`);
}

/**
 * Delete a saved quiz.
 */
export async function deleteQuiz(quizId) {
  return request("DELETE", `/history/quizzes/${quizId}`);
}

/**
 * Save a completed quiz attempt.
 * answers: { "0": 2, "1": 0, ... }
 */
export async function saveQuizAttempt(quizId, answers, score, total) {
  return request("POST", `/history/quizzes/${quizId}/attempts`, {
    answers,
    score,
    total,
  });
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
