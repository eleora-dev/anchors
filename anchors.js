/* ============================================================================
 *  Eleòra Anchors — Main script
 *  https://github.com/eleora-dev/anchors
 *  License: MIT
 *  ============================================================================ */


/* ── Browser detection ────────────────────────────────────────────────────── */

/**
 * Detect the current browser from the user-agent string.
 * Returns "edge", "firefox", or "chrome" (default / fallback).
 *
 * Edge is Chromium-based and shares the chrome.* API surface, but uses
 * different internal URLs and different "private mode" terminology.
 * Firefox is listed for future compatibility; it supports chrome.* via a
 * thin shim, but a browser.* Promise-based adapter would be needed for
 * full support.
 *
 * @returns {"edge"|"firefox"|"chrome"}
 */
function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes("Edg/"))     return "edge";
    if (ua.includes("Firefox/")) return "firefox";
    return "chrome";
}

const BROWSER = detectBrowser();

/**
 * Thin compatibility shim: Firefox exposes browser.* with native Promises;
 * Chrome and Edge expose chrome.* with callbacks.  Both are present here so
 * the rest of the file always has a valid `api` object to call, regardless
 * of engine.  The shim only matters if this extension is ever packaged for
 * Firefox; Chrome and Edge both expose window.chrome natively.
 *
 * @type {typeof chrome}
 */
const api = (typeof browser !== "undefined") ? browser : chrome;  // eslint-disable-line no-undef


/* ── Browser-specific internal URLs ──────────────────────────────────────── */

/**
 * Internal page URLs that differ between browsers.
 * Centralised here so button handlers never hard-code a browser name.
 */
const INTERNAL_URLS = {
    bookmarks: BROWSER === "edge"    ? "edge://favorites/"
    : BROWSER === "firefox" ? "about:bookmarks"
    :                         "chrome://bookmarks/",

    settings:  BROWSER === "edge"    ? "edge://settings/"
    : BROWSER === "firefox" ? "about:preferences"
    :                         "chrome://settings/",
};


/* ── Localisation ─────────────────────────────────────────────────────────── */

// Detect browser language: Italian if it starts with "it", English otherwise
const lang = (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";
document.documentElement.lang = lang;

const i18n = {
    en: {
        // Navbar tooltips
        logoLink:           "Eleòra on GitHub",
        copyUrl:            "Copy a clean version of the current page URL to clipboard (tracking parameters are stripped)",
        cleanRefresh:       "Clear site cache and reload the page",
        clearCache:         "Clear cache, history, downloads and local data (no cookies) for all sites",
        incognito:          "Open a new incognito window",
        incognitoEdge:      "Open a new InPrivate window",
        bookmarks:          "Open bookmarks manager",
        settings:           "Open browser settings",
        // Accessibility (aria-labels)
        ariaCopy:           "Copy clean URL",
        ariaRefresh:        "Clean reload",
        ariaClear:          "Clear browsing data",
        ariaIncognito:      "Open incognito window",
        ariaIncognitoEdge:  "Open InPrivate window",
        ariaBookmarks:      "Open bookmarks",
        ariaSettings:       "Open settings",
        // Alert banner
        privateBanner:      "⚠ Extension not enabled in incognito mode — click to enable",
        privateBannerEdge:  "⚠ Extension not enabled in InPrivate mode — click to enable",
        // Footer
        footer: "<a href='https://eleora-dev.github.io/anchors/privacy.html' target='_blank' rel='noopener noreferrer' title='Privacy policy'>Privacy</a><a href='https://github.com/eleora-dev/anchors/blob/main/LICENSE' target='_blank' rel='noopener noreferrer' title='MIT License'>License</a><a href='https://github.com/eleora-dev/anchors/issues' target='_blank' rel='noopener noreferrer' title='Report an issue on GitHub'>Report issue</a>",
        // Misc
        by:                 "by",
        folder:             "Folder",         // fallback for unnamed folders
        // Context menu
        ctxOpen:            "Open",
        ctxNewTab:          "Open in new tab",
        ctxNewTabHint:      "Ctrl+Click",     // shortcut shown on the right
        ctxNewWindow:       "Open in new window",
        ctxIncognito:       "Open in private window",
        ctxIncognitoEdge:   "Open in InPrivate window",
        ctxCopyUrl:         "Copy URL",
    },
    it: {
        // Navbar tooltips
        logoLink:           "Eleòra su GitHub",
        copyUrl:            "Copia una versione pulita dell'URL della pagina corrente negli appunti (eventuali parametri di tracking vengono rimossi)",
        cleanRefresh:       "Pulisci la cache del sito e ricarica la pagina",
        clearCache:         "Elimina cache, cronologia, download e dati locali (cookie esclusi) per tutti i siti",
        incognito:          "Apri una nuova finestra in incognito",
        incognitoEdge:      "Apri una nuova finestra InPrivate",
        bookmarks:          "Accedi alla gestione dei preferiti",
        settings:           "Apri le impostazioni del browser",
        // Accessibility (aria-labels)
        ariaCopy:           "Copia URL pulito",
        ariaRefresh:        "Ricarica pulita",
        ariaClear:          "Cancella dati di navigazione",
        ariaIncognito:      "Apri finestra in incognito",
        ariaIncognitoEdge:  "Apri finestra InPrivate",
        ariaBookmarks:      "Apri preferiti",
        ariaSettings:       "Apri impostazioni",
        // Alert banner
        privateBanner:      "⚠ Anchors non è consentito in modalità Incognito — clicca per abilitarlo",
        privateBannerEdge:  "⚠ Anchors non è consentito in modalità InPrivate — clicca per abilitarlo",
        // Footer
        footer: "<a href='https://eleora-dev.github.io/anchors/privacy.html' target='_blank' rel='noopener noreferrer' title='Informativa sulla privacy'>Privacy</a><a href='https://github.com/eleora-dev/anchors/blob/main/LICENSE' target='_blank' rel='noopener noreferrer' title='Licenza MIT'>Licenza</a><a href='https://github.com/eleora-dev/anchors/issues' target='_blank' rel='noopener noreferrer' title='Segnala un problema su GitHub'>Segnala problema</a>",
        // Misc
        by:                 "di",
        folder:             "Cartella",       // fallback for unnamed folders
        // Context menu
        ctxOpen:            "Apri",
        ctxNewTab:          "Apri in un'altra scheda",
        ctxNewTabHint:      "Ctrl+Clic",      // shortcut shown on the right
        ctxNewWindow:       "Apri in una nuova finestra",
        ctxIncognito:       "Apri in una finestra privata",
        ctxIncognitoEdge:   "Apri in una finestra InPrivate",
        ctxCopyUrl:         "Copia URL",
    }
};

// Short alias used throughout the file
const T = i18n[lang];

// Patch Edge-specific terminology into T so no other code needs conditionals
if (BROWSER === "edge") {
    T.incognito    = T.incognitoEdge;
    T.ariaIncognito = T.ariaIncognitoEdge;
    T.privateBanner = T.privateBannerEdge;
    T.ctxIncognito  = T.ctxIncognitoEdge;
}


/* ── Constants ────────────────────────────────────────────────────────────── */

// ID of the Bookmarks Bar folder (child "1" of Chrome's internal root "0").
// Both Chrome and Edge (Chromium) use "1" for the top-level bar.
const ROOT_FOLDER_ID = "1";

// Visual feedback color applied to navbar buttons after a successful action.
// Matches --footer-bg; defined here as a JS constant to stay in sync with CSS.
const FEEDBACK_COLOR = "#1565d8";


/* ── DOM references ───────────────────────────────────────────────────────── */

const subtitleEl      = document.getElementById("subtitle");
const list            = document.getElementById("list");
const pathEl          = document.getElementById("path");
const rootDotLink     = document.getElementById("root-dot-link");
const copyBtn         = document.getElementById("copy-url");
const cleanRefreshBtn = document.getElementById("clean-refresh");
const clearBtn        = document.getElementById("clear-cache");
const incognitoBtn    = document.getElementById("incognito");
const bookmarksBtn    = document.getElementById("bookmarks");
const settingsBtn     = document.getElementById("settings");
const footerEl        = document.getElementById("footer");

let isPrivateWindow = false;

// Disable the clear button immediately to prevent clicks before the async
// incognito check resolves (race-condition guard). It is re-enabled below if
// the window is not private.
clearBtn.disabled = true;

api.windows.getCurrent((win) => {
    isPrivateWindow = !!win?.incognito;

    if (isPrivateWindow) {
        clearBtn.removeAttribute("title");
        clearBtn.removeAttribute("aria-label");
    } else {
        clearBtn.disabled = false;
    }
});


/* ── State ────────────────────────────────────────────────────────────────── */

const manifest        = api.runtime.getManifest();
const expandedFolders = new Set();   // IDs of currently open folders
const parentMap       = new Map();   // childId → parentId, used to detect folder ancestry

let selectedIndex     = -1;   // index of the keyboard-selected item


/* ── Toolbar icon (dark / light) ──────────────────────────────────────────── */

// Update the browser toolbar icon based on the active color scheme.
// Runs on every popup open. window.matchMedia is available in the popup
// context but not in a service worker, so this is the correct place for it.
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
api.action.setIcon({
    path: {
        "16":  isDark ? "assets/icon-16-dark.png"  : "assets/icon-16.png",
        "32":  isDark ? "assets/icon-32-dark.png"  : "assets/icon-32.png",
        "48":  isDark ? "assets/icon-48-dark.png"  : "assets/icon-48.png",
        "128": isDark ? "assets/icon-128-dark.png" : "assets/icon-128.png"
    }
}, () => {
    if (api.runtime.lastError) {
        console.error("Failed to set toolbar icon:", api.runtime.lastError.message);
    }
});


/* ── Apply translations to static UI ─────────────────────────────────────── */

rootDotLink.title     = T.logoLink;
copyBtn.title         = T.copyUrl;
cleanRefreshBtn.title = T.cleanRefresh;
clearBtn.title        = T.clearCache;
incognitoBtn.title    = T.incognito;
bookmarksBtn.title    = T.bookmarks;
settingsBtn.title     = T.settings;

rootDotLink.setAttribute("aria-label", T.logoLink);
copyBtn.setAttribute("aria-label", T.ariaCopy);
cleanRefreshBtn.setAttribute("aria-label", T.ariaRefresh);
clearBtn.setAttribute("aria-label", T.ariaClear);
incognitoBtn.setAttribute("aria-label", T.ariaIncognito);
bookmarksBtn.setAttribute("aria-label", T.ariaBookmarks);
settingsBtn.setAttribute("aria-label", T.ariaSettings);

if (footerEl) footerEl.innerHTML = T.footer;

if (subtitleEl && manifest.author) {
    subtitleEl.textContent = `${T.by} ${manifest.author}`;
}


/* ── URL cleaning ─────────────────────────────────────────────────────────── */

// TRACKING_PARAMS and TRACKING_PREFIXES are defined in trackers.js, loaded before this script.

/**
 * Return a copy of the URL with all known tracking parameters removed.
 * If the URL cannot be parsed (e.g. chrome://...) the original string is returned.
 *
 * @param {string} rawUrl
 * @returns {string}
 */
function cleanUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return rawUrl;  // unparseable URL — return as-is
    }

    for (const key of [...parsed.searchParams.keys()]) {
        const lower = key.toLowerCase();

        if (
            TRACKING_PARAMS.has(lower) ||
            (typeof TRACKING_PREFIXES !== "undefined" &&
            TRACKING_PREFIXES.some(prefix => lower.startsWith(prefix)))
        ) {
            parsed.searchParams.delete(key);
        }
    }
    return parsed.toString();
}


/* ── Navbar buttons ───────────────────────────────────────────────────────── */

// Copy the active tab URL to the clipboard
copyBtn.onclick = () => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) return;

        navigator.clipboard.writeText(cleanUrl(tab.url))
        .then(() => {
            copyBtn.style.color = FEEDBACK_COLOR;  // visual feedback
            setTimeout(() => window.close(), 500);
        })
        .catch((err) => {
            console.error("Failed to copy URL:", err);
        });
    });
};

// Clear the current site's cache and reload the page
cleanRefreshBtn.onclick = () => {
    api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id || !tab.url) return;

        let origin;
        try {
            const parsed = new URL(tab.url);
            // browsingData.remove only supports http/https origins
            if (!parsed.protocol.startsWith("http")) {
                api.tabs.reload(tab.id, { bypassCache: true });
                window.close();
                return;
            }
            origin = parsed.origin;
        } catch {
            // Unparseable URL (e.g. chrome:// or edge://...): reload without clearing
            api.tabs.reload(tab.id, { bypassCache: true });
            window.close();
            return;
        }

        api.browsingData.remove(
            { origins: [origin] },
            { cache: true, cacheStorage: true },
            () => {
                if (api.runtime.lastError) {
                    console.error(api.runtime.lastError.message);
                    return;
                }
                api.tabs.reload(tab.id, { bypassCache: true }, () => {
                    cleanRefreshBtn.style.color = FEEDBACK_COLOR;  // visual feedback
                    setTimeout(() => window.close(), 500);
                });
            }
        );
    });
};

// Clear cache, history, downloads and local data for all sites
// Cookies are intentionally excluded to avoid logging the user out of websites
clearBtn.onclick = () => {
    if (isPrivateWindow) return;

    api.browsingData.remove(
        { since: 0 },
        {
            cache:          true,
            cacheStorage:   true,
            downloads:      true,
            formData:       true,
            history:        true,
            indexedDB:      true,
            localStorage:   true,
            serviceWorkers: true
        },
        () => {
            if (api.runtime.lastError) {
                console.error(api.runtime.lastError.message);
                return;
            }
            clearBtn.style.color = FEEDBACK_COLOR;  // visual feedback
            setTimeout(() => window.close(), 500);
        }
    );
};


// Open a new incognito / InPrivate window
incognitoBtn.onclick = () => {
    api.windows.create({ incognito: true, state: "maximized" }, () => {
        if (api.runtime.lastError) {
            console.error("Failed to open private window:", api.runtime.lastError.message);
            return;
        }
        window.close();
    });
};

// Open the bookmarks / favorites manager (URL differs per browser)
bookmarksBtn.onclick = () => {
    api.tabs.create({ url: INTERNAL_URLS.bookmarks }, () => {
        if (api.runtime.lastError) {
            console.error("Failed to open bookmarks manager:", api.runtime.lastError.message);
            return;
        }
        window.close();
    });
};

// Open browser settings (URL differs per browser)
settingsBtn.onclick = () => {
    api.tabs.create({ url: INTERNAL_URLS.settings }, () => {
        if (api.runtime.lastError) {
            console.error("Failed to open settings:", api.runtime.lastError.message);
            return;
        }
        window.close();
    });
};


/* ── Incognito / InPrivate access check ───────────────────────────────────── */

// If the extension is not allowed in private mode, show a banner prompting
// the user to enable it. The incognito button is NOT overridden: it always
// opens a new private window regardless of this setting.
//
// NOTE: chrome.extension.isAllowedIncognitoAccess is deprecated in MV3, but
// has no replacement in the current MV3 API surface.  We guard the call so
// the extension keeps working even if the method is eventually removed.
if (typeof api.extension?.isAllowedIncognitoAccess === "function") {
    api.extension.isAllowedIncognitoAccess((allowed) => {
        if (!allowed) {
            const banner = document.getElementById("incognito-banner");
            banner.textContent = T.privateBanner;
            banner.style.display = "block";
            banner.onclick = () => {
                api.tabs.create({ url: INTERNAL_URLS.settings + "?search=extensions" });
                window.close();
            };
        }
    });
} else {
    // API not available (future-proofing): silently skip the banner.
    console.warn("isAllowedIncognitoAccess is unavailable; private-mode banner disabled.");
}


/* ── Context menu ─────────────────────────────────────────────────────────── */

let activeCtxMenu = null;  // reference to the currently visible menu

// Remove the context menu from the DOM
function closeContextMenu() {
    if (activeCtxMenu) {
        activeCtxMenu.remove();
        activeCtxMenu = null;
    }
}

// Execute the action selected from the context menu
function handleCtxAction(action, url) {
    switch (action) {
        case "open":
            // Navigate in the current tab
            api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab?.id) return;
                api.tabs.update(tab.id, { url, active: true }, () => {
                    api.windows.update(tab.windowId, { focused: true }, () => {
                        window.close();
                    });
                });
            });
            break;

        case "tab":
            // Open in a new tab
            api.tabs.create({ url, active: true }, () => window.close());
            break;

        case "window":
            // Open in a new maximized window
            api.windows.create({ url, state: "maximized", focused: true }, () => window.close());
            break;

        case "incognito":
            // Open in a new private window (incognito / InPrivate)
            api.windows.create({ url, incognito: true, state: "maximized", focused: true }, () => window.close());
            break;

        case "copy":
            // Copy the URL to the clipboard
            navigator.clipboard.writeText(url)
            .then(() => window.close())
            .catch((err) => {
                console.error("Failed to copy URL:", err);
            });
            break;
    }
}

// Build and show the context menu at the click position
function showContextMenu(e, url) {
    e.preventDefault();
    closeContextMenu();

    const menu = document.createElement("div");
    menu.id = "ctx-menu";
    menu.setAttribute("role", "menu");

    // Menu entries — null renders as a horizontal separator
    const entries = [
        { label: T.ctxOpen,      action: "open"      },
        { label: T.ctxNewTab,    action: "tab",       hint: T.ctxNewTabHint },
        { label: T.ctxNewWindow, action: "window"     },
        { label: T.ctxIncognito, action: "incognito"  },
        null,
        { label: T.ctxCopyUrl,   action: "copy"       },
    ];

    for (const entry of entries) {
        if (entry === null) {
            const sep = document.createElement("div");
            sep.className = "ctx-separator";
            menu.appendChild(sep);
            continue;
        }

        const item = document.createElement("div");
        item.className = "ctx-item";
        item.setAttribute("role", "menuitem");
        item.setAttribute("tabindex", "0");

        const labelSpan = document.createElement("span");
        labelSpan.textContent = entry.label;
        item.appendChild(labelSpan);

        // Optional shortcut label aligned to the right
        if (entry.hint) {
            const hintSpan = document.createElement("span");
            hintSpan.className = "ctx-shortcut";
            hintSpan.textContent = entry.hint;
            item.appendChild(hintSpan);
        }

        item.addEventListener("mousedown", (ev) => {
            ev.stopPropagation();  // prevent immediate menu close
            handleCtxAction(entry.action, url);
            closeContextMenu();
        });

        item.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                handleCtxAction(entry.action, url);
                closeContextMenu();
            }
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                const next = item.nextElementSibling?.classList.contains("ctx-separator")
                ? item.nextElementSibling.nextElementSibling
                : item.nextElementSibling;
                next?.focus();
            }
            if (ev.key === "ArrowUp") {
                ev.preventDefault();
                const prev = item.previousElementSibling?.classList.contains("ctx-separator")
                ? item.previousElementSibling.previousElementSibling
                : item.previousElementSibling;
                prev?.focus();
            }
        });

        menu.appendChild(item);
    }

    document.body.appendChild(menu);
    activeCtxMenu = menu;

    // Position at cursor, clamping to stay within the popup bounds
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuW > window.innerWidth)  x = window.innerWidth  - menuW - 4;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 4;

    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;

    const firstItem = menu.querySelector(".ctx-item");
    if (firstItem) firstItem.focus();
}

// Close the menu when clicking outside it
document.addEventListener("mousedown", (e) => {
    if (activeCtxMenu && !activeCtxMenu.contains(e.target)) {
        closeContextMenu();
    }
});

// Close the menu when the bookmark list is scrolled
list.addEventListener("scroll", closeContextMenu, { passive: true });


/* ── Bookmark utilities ───────────────────────────────────────────────────── */

/**
 * Return the favicon URL for a given page URL.
 *
 * Both Chrome and Edge support the chrome-extension://<id>/_favicon/ endpoint.
 * A data-URI fallback is provided for hypothetical environments where the
 * endpoint is unavailable (e.g. future API changes or unit-test contexts).
 *
 * @param {string} url
 * @returns {string}
 */
function getFavicon(url) {
    if (!api.runtime?.id) {
        // Fallback: transparent 1×1 pixel so <img> never shows a broken icon
        return "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=";
    }
    const encodedUrl = encodeURIComponent(url);
    return `chrome-extension://${api.runtime.id}/_favicon/?pageUrl=${encodedUrl}&size=32`;
}

// Promise wrapper for chrome.bookmarks.getChildren
function getChildren(folderId) {
    return new Promise((resolve, reject) => {
        api.bookmarks.getChildren(folderId, (results) => {
            if (api.runtime.lastError) {
                reject(new Error(api.runtime.lastError.message));
            } else {
                resolve(results);
            }
        });
    });
}

// Return all .item elements currently in the DOM
function getItems() {
    return [...document.querySelectorAll(".item")];
}


/* ── Keyboard selection ───────────────────────────────────────────────────── */

// Update keyboard selection, move focus to the current item, and scroll it into view
function updateSelection() {
    const items = getItems();
    items.forEach((item) => item.classList.remove("selected"));

    if (!items.length || selectedIndex < 0) return;
    if (selectedIndex >= items.length) selectedIndex = items.length - 1;

    items[selectedIndex].classList.add("selected");
    items[selectedIndex].focus();
    items[selectedIndex].scrollIntoView({ block: "nearest" });
}


/* ── Incremental folder DOM management ────────────────────────────────────── */

// Remove from the DOM all direct children of folderId,
// recursively removing their descendants too
function removeFolderChildrenFromDOM(folderId) {
    const children = list.querySelectorAll(`[data-parent-folder="${folderId}"]`);
    for (const child of children) {
        if (child.dataset.type === "folder") {
            removeFolderChildrenFromDOM(child.dataset.id);
            expandedFolders.delete(child.dataset.id);
        }
        child.remove();
    }
}

// Insert children of folderId into the DOM immediately after folderEl,
// without touching any other part of the list
async function insertFolderChildrenIntoDOM(folderEl, folderId, level) {
    let nodes;
    try {
        nodes = await getChildren(folderId);
    } catch (err) {
        console.error("Failed to get bookmark children for folder", folderId, err);
        return;
    }

    let ref = folderEl;  // insertion reference: each new element goes after this one

    for (const node of nodes) {
        parentMap.set(node.id, folderId);

        const el = node.url
        ? createBookmarkItem(node, level)
        : createFolderItem(node, level);

        // Tag the element so we can find and remove it later
        el.dataset.parentFolder = folderId;
        ref.insertAdjacentElement("afterend", el);
        void el.offsetHeight;  // force reflow so the browser registers the element before adding the animation class
        el.classList.add("item--animate");
        ref = el;
    }
}

// Close all open folders that are NOT ancestors of targetFolderId.
// Used to enforce exclusive opening: only one branch open at a time.
function closeUnrelatedFolders(targetFolderId) {
    for (const id of [...expandedFolders]) {
        // Check whether id is an ancestor of targetFolderId
        let pid = targetFolderId;
        let isAncestor = false;
        while (pid && pid !== ROOT_FOLDER_ID) {
            if (pid === id) { isAncestor = true; break; }
            pid = parentMap.get(pid);
        }
        if (isAncestor) continue;

        // Close this unrelated folder
        const folderEl = list.querySelector(`[data-id="${id}"]`);
        if (folderEl) {
            removeFolderChildrenFromDOM(id);
            folderEl.classList.remove("open");
            folderEl.setAttribute("aria-expanded", "false");
            const arrow = folderEl.querySelector(".folder-arrow");
            if (arrow) arrow.textContent = "▸";
        }
        expandedFolders.delete(id);
    }
}


/* ── DOM element creation ─────────────────────────────────────────────────── */

// Create a DOM element for a bookmark
function createBookmarkItem(node, level) {
    const div = document.createElement("div");
    div.className = "item bookmark";
    div.dataset.type = "bookmark";
    div.dataset.url = node.url;
    div.style.paddingLeft = `${10 + level * 18}px`;  // indent proportional to depth
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", node.title || node.url);
    div.setAttribute("tabindex", "0");

    const img = document.createElement("img");
    img.className = "icon";
    img.alt = "";
    img.src = getFavicon(node.url);

    const span = document.createElement("span");
    span.className = "title";
    span.textContent = node.title || node.url;  // fall back to URL if title is empty

    div.appendChild(img);
    div.appendChild(span);

    // Left-click: open in current tab; Ctrl+Click: open in a new tab
    div.addEventListener("click", (e) => {
        if (e.ctrlKey) {
            api.tabs.create({ url: node.url, active: true }, () => window.close());
            return;
        }

        api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return;

            api.tabs.update(tab.id, { url: node.url, active: true }, () => {
                api.windows.update(tab.windowId, { focused: true }, () => {
                    window.close();
                });
            });
        });
    });

    div.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            div.click();
        }
    });

    // Right-click: show custom context menu
    div.addEventListener("contextmenu", (e) => showContextMenu(e, node.url));

    return div;
}

// Create a DOM element for a folder
function createFolderItem(node, level) {
    const div = document.createElement("div");
    div.className = "item folder";

    if (expandedFolders.has(node.id)) {
        div.classList.add("open");
    }

    div.dataset.type = "folder";
    div.dataset.id = node.id;
    div.style.paddingLeft = `${10 + level * 18}px`;

    // Keyboard focus and expandable state
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", node.title || T.folder);
    div.setAttribute("tabindex", "0");
    div.setAttribute("aria-expanded", expandedFolders.has(node.id) ? "true" : "false");

    const arrow = document.createElement("span");
    arrow.className = "folder-arrow";
    arrow.textContent = expandedFolders.has(node.id) ? "▾" : "▸";

    const folderIcon = document.createElement("span");
    folderIcon.className = "folder-icon";
    folderIcon.textContent = "📁";

    const span = document.createElement("span");
    span.className = "title";
    span.textContent = node.title || T.folder;  // localized fallback for unnamed folders

    div.appendChild(arrow);
    div.appendChild(folderIcon);
    div.appendChild(span);

    // Right-click on folders: suppress both custom and system context menus
    div.addEventListener("contextmenu", (e) => e.preventDefault());

    // Left-click: toggle folder open/closed using incremental DOM updates
    div.onclick = async () => {

        if (expandedFolders.has(node.id)) {
            // Close: remove children from DOM, update visual state
            removeFolderChildrenFromDOM(node.id);
            expandedFolders.delete(node.id);
            div.classList.remove("open");
            arrow.textContent = "▸";
            div.setAttribute("aria-expanded", "false");
        } else {
            // Open: close unrelated folders, insert children after this element
            closeUnrelatedFolders(node.id);
            expandedFolders.add(node.id);
            div.classList.add("open");
            arrow.textContent = "▾";
            div.setAttribute("aria-expanded", "true");
            await insertFolderChildrenIntoDOM(div, node.id, level + 1);
        }

        // Keep keyboard selection on the toggled folder
        const items = getItems();
        const idx = items.indexOf(div);
        if (idx !== -1) selectedIndex = idx;
        updateSelection();
    };

    return div;
}


/* ── List rendering ───────────────────────────────────────────────────────── */

// Populate the container with the children of a folder,
// recursively rendering any expanded subfolders.
// Used only for the initial load.
async function renderFolder(folderId, container, level = 0) {
    let nodes;
    try {
        nodes = await getChildren(folderId);
    } catch (err) {
        console.error("Failed to get bookmark children for folder", folderId, err);
        return;
    }

    for (const node of nodes) {
        parentMap.set(node.id, folderId);  // record parentage for ancestry detection

        const el = node.url
        ? createBookmarkItem(node, level)
        : createFolderItem(node, level);

        // Animate this item on entry
        el.classList.add("item--animate");

        // Tag the element so incremental updates can find and remove it
        el.dataset.parentFolder = folderId;
        container.appendChild(el);

        if (!node.url && expandedFolders.has(node.id)) {
            await renderFolder(node.id, container, level + 1);
        }
    }
}

// Full render — called once at startup only
async function render() {
    list.innerHTML = "";
    pathEl.textContent = manifest.name;
    await renderFolder(ROOT_FOLDER_ID, list);
}


/* ── Keyboard navigation ──────────────────────────────────────────────────── */

document.addEventListener("keydown", (e) => {
    // If the context menu is open, only Escape is handled
    if (activeCtxMenu) {
        if (e.key === "Escape") closeContextMenu();
        return;
    }

    const items   = getItems();
    const current = items[selectedIndex];

    if (!items.length) return;

    if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
        updateSelection();
    }

    if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(0, selectedIndex - 1);
        updateSelection();
    }

    if (e.key === "Enter") {
        e.preventDefault();
        current?.click();
    }

    // ArrowRight: open the selected folder
    if (e.key === "ArrowRight" && current?.dataset.type === "folder" && !current.classList.contains("open")) {
        e.preventDefault();
        current.click();
    }

    // ArrowLeft: close the selected folder
    if (e.key === "ArrowLeft" && current?.dataset.type === "folder" && current.classList.contains("open")) {
        e.preventDefault();
        current.click();
    }
});


/* ── Entry point ──────────────────────────────────────────────────────────── */

render();
