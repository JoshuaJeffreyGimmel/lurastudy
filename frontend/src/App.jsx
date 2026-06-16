import React from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import DecksPage from "./pages/DecksPage.jsx";
import DeckWorkspacePage from "./pages/DeckWorkspacePage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StudyPage from "./pages/StudyPage.jsx";

export default function App() {
  return (
    <div className="app-layout">
      <nav className="app-nav">
        <span className="brand">📚 LuraStudy</span>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/decks">Decks</NavLink>
        <NavLink to="/documents">Documents</NavLink>
        <NavLink to="/settings" className="nav-settings">⚙ Settings</NavLink>
      </nav>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/decks/:deckId" element={<DeckWorkspacePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/study/:deckId" element={<StudyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
