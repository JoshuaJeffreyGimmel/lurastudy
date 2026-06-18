import React, { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { applyTheme } from "./theme.js";
import { getSettings } from "./api/client.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import StatusBanner from "./components/StatusBanner.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DecksPage from "./pages/DecksPage.jsx";
import DeckWorkspacePage from "./pages/DeckWorkspacePage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import OnboardingPage, { isOnboardingDone } from "./pages/OnboardingPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StudyPage from "./pages/StudyPage.jsx";

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Load the user's theme on app mount
  useEffect(() => {
    if (user) {
      getSettings()
        .then((settings) => applyTheme(settings))
        .catch(() => {
          // Silently ignore — theme will remain at defaults
        });
    }
  }, [user]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <span className="brand">📚 LuraStudy</span>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/decks">Decks</NavLink>
        <NavLink to="/documents">Documents</NavLink>
        <NavLink to="/settings" className="nav-settings">⚙ Settings</NavLink>
        {user && (
          <span className="nav-user">
            <span className="nav-username">{user.username}</span>
            <button className="nav-logout-btn" onClick={handleLogout} title="Sign out">
              Sign out
            </button>
          </span>
        )}
      </nav>
      <StatusBanner />
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {user && !isOnboardingDone() ? <OnboardingPage /> : <Dashboard />}
              </ProtectedRoute>
            }
          />
          <Route path="/decks" element={<ProtectedRoute><DecksPage /></ProtectedRoute>} />
          <Route path="/decks/:deckId" element={<ProtectedRoute><DeckWorkspacePage /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/study/:deckId" element={<ProtectedRoute><StudyPage /></ProtectedRoute>} />
          <Route path="/quiz/:deckId" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}