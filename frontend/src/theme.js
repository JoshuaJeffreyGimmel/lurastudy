/**
 * Theme utility — applies CSS custom properties from user settings.
 * Call `applyTheme(settings)` on page load and whenever settings change.
 */

// Map backend setting keys to CSS custom property names
export const CSS_VAR_MAP = {
  theme_bg: "--color-bg",
  theme_surface: "--color-surface",
  theme_surface_2: "--color-surface-2",
  theme_border: "--color-border",
  theme_primary: "--color-primary",
  theme_primary_hover: "--color-primary-hover",
  theme_success: "--color-success",
  theme_warning: "--color-warning",
  theme_danger: "--color-danger",
  theme_text: "--color-text",
  theme_text_muted: "--color-text-muted",
};

const FONT_KEY = "theme_font";

/**
 * Apply a theme object (from settings API) to the document's CSS variables.
 * @param {object} settings - Settings object with theme_* and theme_font keys
 */
export function applyTheme(settings) {
  const root = document.documentElement;

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = settings[key];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }

  if (settings[FONT_KEY]) {
    root.style.setProperty("--theme-font", settings[FONT_KEY]);
    root.style.fontFamily = settings[FONT_KEY];
  }
}

/**
 * Theme default values (matching index.css dark theme).
 */
export const DEFAULT_THEME = {
  theme_bg: "#0f1117",
  theme_surface: "#1a1d27",
  theme_surface_2: "#22263a",
  theme_border: "#2e3250",
  theme_primary: "#6c63ff",
  theme_primary_hover: "#5a52e0",
  theme_success: "#22c55e",
  theme_warning: "#f59e0b",
  theme_danger: "#ef4444",
  theme_text: "#e2e8f0",
  theme_text_muted: "#8892a4",
  theme_font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/**
 * A light theme preset.
 */
export const LIGHT_THEME = {
  theme_bg: "#f8f9fa",
  theme_surface: "#ffffff",
  theme_surface_2: "#e9ecef",
  theme_border: "#dee2e6",
  theme_primary: "#5b5bd7",
  theme_primary_hover: "#4a4ac0",
  theme_success: "#22c55e",
  theme_warning: "#f59e0b",
  theme_danger: "#ef4444",
  theme_text: "#1a1a2e",
  theme_text_muted: "#6c757d",
  theme_font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/**
 * Map CSS variable names back to preference labels for the UI.
 */
export const THEME_LABELS = {
  theme_bg: "Background",
  theme_surface: "Surface / Card",
  theme_surface_2: "Secondary Surface",
  theme_border: "Borders",
  theme_primary: "Primary Accent",
  theme_primary_hover: "Primary Hover",
  theme_success: "Success",
  theme_warning: "Warning",
  theme_danger: "Danger",
  theme_text: "Text",
  theme_text_muted: "Muted Text",
  theme_font: "Font",
};

/**
 * Font options for the font selector.
 */
export const FONT_OPTIONS = [
  {
    label: "System UI (default)",
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  { label: "Sans-serif", value: "sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "'Courier New', Courier, monospace" },
];