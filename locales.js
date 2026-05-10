/* ============================================================================
 *  Eleòra Anchors — Localisation
 *  https://github.com/eleora-dev/anchors
 *  License: MIT
 *  ============================================================================ */


/* ── Detect browser language ──────────────────────────────────────────────── */

// Italian if the browser locale starts with "it", English otherwise
const lang = (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";
document.documentElement.lang = lang;


/* ── Translation table ────────────────────────────────────────────────────── */

const i18n = {
    en: {
        // Navbar tooltips
        logoLink: "Eleòra on GitHub",
        copyUrl: "Copy a clean version of the current page URL to clipboard (tracking parameters are stripped)",
        cleanRefresh: "Clear site cache and reload the page",
        clearCache: "Clear cache, history, downloads and local data (no cookies) for all sites",
        incognito: "Open a new incognito window",
        incognitoEdge: "Open a new InPrivate window",
        bookmarks: "Open bookmarks manager",
        settings: "Open browser settings",
        // Accessibility (aria-labels)
        ariaCopy: "Copy clean URL",
        ariaRefresh: "Clean reload",
        ariaClear: "Clear browsing data",
        ariaIncognito: "Open incognito window",
        ariaIncognitoEdge: "Open InPrivate window",
        ariaBookmarks: "Open bookmarks",
        ariaSettings: "Open settings",
        // Alert banner
        privateBanner: "⚠ Extension not enabled in incognito mode — click to enable",
        privateBannerEdge: "⚠ Extension not enabled in InPrivate mode — click to enable",
        // Footer
        footer: "<a href='https://eleora-dev.github.io/anchors/privacy.html' target='_blank' rel='noopener noreferrer' title='Privacy policy'>Privacy</a><a href='https://github.com/eleora-dev/anchors/blob/main/LICENSE' target='_blank' rel='noopener noreferrer' title='MIT License'>License</a><a href='https://github.com/eleora-dev/anchors/issues' target='_blank' rel='noopener noreferrer' title='Report an issue on GitHub'>Report issue</a>",
        // Misc
        by: "by",
        folder: "Folder", // fallback for unnamed folders
        // Context menu
        ctxOpen: "Open",
        ctxNewTab: "Open in new tab",
        ctxNewTabHint: "Ctrl+Click", // shortcut shown on the right
        ctxNewWindow: "Open in new window",
        ctxIncognito: "Open in private window",
        ctxIncognitoEdge: "Open in InPrivate window",
        ctxCopyUrl: "Copy URL",
    },
    it: {
        // Navbar tooltips
        logoLink: "Eleòra su GitHub",
        copyUrl: "Copia una versione pulita dell'URL della pagina corrente negli appunti (eventuali parametri di tracking vengono rimossi)",
        cleanRefresh: "Pulisci la cache del sito e ricarica la pagina",
        clearCache: "Elimina cache, cronologia, download e dati locali (cookie esclusi) per tutti i siti",
        incognito: "Apri una nuova finestra in incognito",
        incognitoEdge: "Apri una nuova finestra InPrivate",
        bookmarks: "Accedi alla gestione dei preferiti",
        settings: "Apri le impostazioni del browser",
        // Accessibility (aria-labels)
        ariaCopy: "Copia URL pulito",
        ariaRefresh: "Ricarica pulita",
        ariaClear: "Cancella dati di navigazione",
        ariaIncognito: "Apri finestra in incognito",
        ariaIncognitoEdge: "Apri finestra InPrivate",
        ariaBookmarks: "Apri preferiti",
        ariaSettings: "Apri impostazioni",
        // Alert banner
        privateBanner: "⚠ Anchors non è consentito in modalità Incognito — clicca per abilitarlo",
        privateBannerEdge: "⚠ Anchors non è consentito in modalità InPrivate — clicca per abilitarlo",
        // Footer
        footer: "<a href='https://eleora-dev.github.io/anchors/privacy.html' target='_blank' rel='noopener noreferrer' title='Informativa sulla privacy'>Privacy</a><a href='https://github.com/eleora-dev/anchors/blob/main/LICENSE' target='_blank' rel='noopener noreferrer' title='Licenza MIT'>Licenza</a><a href='https://github.com/eleora-dev/anchors/issues' target='_blank' rel='noopener noreferrer' title='Segnala un problema su GitHub'>Segnala problema</a>",
        // Misc
        by: "di",
        folder: "Cartella", // fallback for unnamed folders
        // Context menu
        ctxOpen: "Apri",
        ctxNewTab: "Apri in un'altra scheda",
        ctxNewTabHint: "Ctrl+Clic", // shortcut shown on the right
        ctxNewWindow: "Apri in una nuova finestra",
        ctxIncognito: "Apri in una finestra privata",
        ctxIncognitoEdge: "Apri in una finestra InPrivate",
        ctxCopyUrl: "Copia URL",
    }
};


/* ── Active locale + Edge patch ───────────────────────────────────────────── */

// Short alias used throughout anchors.js
// NOTE: BROWSER is defined in anchors.js — locales.js must be loaded first,
// but the patch below runs after both scripts are parsed, so BROWSER is
// available at execution time (scripts are loaded synchronously by default).
const T = i18n[lang];

// Patch Edge-specific terminology into T so no other code needs conditionals
if (typeof BROWSER !== "undefined" && BROWSER === "edge") {
    T.incognito      = T.incognitoEdge;
    T.ariaIncognito  = T.ariaIncognitoEdge;
    T.privateBanner  = T.privateBannerEdge;
    T.ctxIncognito   = T.ctxIncognitoEdge;
}
