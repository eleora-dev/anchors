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
    if (ua.includes("Edg/")) return "edge";
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
const api = (typeof browser !== "undefined") ? browser : chrome; // eslint-disable-line no-undef


/* ── Browser-specific internal URLs ──────────────────────────────────────── */

/**
 * Internal page URLs that differ between browsers.
 * Centralised here so button handlers never hard-code a browser name.
 */
const INTERNAL_URLS = {
    bookmarks: BROWSER === "edge" ? "edge://favorites/"
    : BROWSER === "firefox" ? "about:bookmarks"
    : "chrome://bookmarks/",

    settings: BROWSER === "edge" ? "edge://settings/"
    : BROWSER === "firefox" ? "about:preferences"
    : "chrome://settings/",
};


/* ── Constants ────────────────────────────────────────────────────────────── */

// ID of the Bookmarks Bar folder (child "1" of Chrome's internal root "0").
// Both Chrome and Edge (Chromium) use "1" for the top-level bar.
const ROOT_FOLDER_ID = "1";

// Visual feedback color applied to navbar buttons after a successful action.
// Matches --footer-bg; defined here as a JS constant to stay in sync with CSS.
const FEEDBACK_COLOR = "#1565d8";

// How many days back the history tab looks.
const HISTORY_DAYS = 7;

// Max history entries to fetch (keeps the list light).
const HISTORY_MAX_RESULTS = 150;


/* ── DOM references ───────────────────────────────────────────────────────── */

const subtitleEl = document.getElementById("subtitle");
const list = document.getElementById("list");
const pathEl = document.getElementById("path");
const rootDotLink = document.getElementById("root-dot-link");
const copyBtn = document.getElementById("copy-url");
const cleanRefreshBtn = document.getElementById("clean-refresh");
const clearBtn = document.getElementById("clear-cache");
const incognitoBtn = document.getElementById("incognito");
const bookmarksBtn = document.getElementById("bookmarks");
const settingsBtn = document.getElementById("settings");
const footerEl = document.getElementById("footer");

// Tab bar
const tabBookmarksBtn = document.getElementById("tab-bookmarks");
const tabHistoryBtn = document.getElementById("tab-history");
const tabBookmarksLabel = document.getElementById("tab-bookmarks-label");
const tabHistoryLabel = document.getElementById("tab-history-label");

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

const manifest = api.runtime.getManifest();
const expandedFolders = new Set(); // IDs of currently open folders
const parentMap = new Map(); // childId → parentId, used to detect folder ancestry

let selectedIndex = -1; // index of the keyboard-selected item
let activeTab = "bookmarks"; // "bookmarks" | "history"


/* ── Toolbar icon (dark / light) ──────────────────────────────────────────── */

// Update the browser toolbar icon based on the active color scheme.
// Runs on every popup open. window.matchMedia is available in the popup
// context but not in a service worker, so this is the correct place for it.
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
api.action.setIcon({
    path: {
        "16": isDark ? "assets/icon-16-dark.png" : "assets/icon-16.png",
        "32": isDark ? "assets/icon-32-dark.png" : "assets/icon-32.png",
        "48": isDark ? "assets/icon-48-dark.png" : "assets/icon-48.png",
        "128": isDark ? "assets/icon-128-dark.png" : "assets/icon-128.png"
    }
}, () => {
    if (api.runtime.lastError) {
        console.error("Failed to set toolbar icon:", api.runtime.lastError.message);
    }
});


/* ── Apply translations to static UI ─────────────────────────────────────── */

rootDotLink.title = T.logoLink;
copyBtn.title = T.copyUrl;
cleanRefreshBtn.title = T.cleanRefresh;
clearBtn.title = T.clearCache;
incognitoBtn.title = T.incognito;
bookmarksBtn.title = T.bookmarks;
settingsBtn.title = T.settings;

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

// Tab bar labels
if (tabBookmarksLabel) tabBookmarksLabel.textContent = T.tabBookmarks;
if (tabHistoryLabel) tabHistoryLabel.textContent = T.tabHistory;
if (tabBookmarksBtn) tabBookmarksBtn.setAttribute("aria-label", T.tabBookmarks);
if (tabHistoryBtn) tabHistoryBtn.setAttribute("aria-label", T.tabHistory);


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
        return rawUrl; // unparseable URL — return as-is
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
            copyBtn.style.color = FEEDBACK_COLOR; // visual feedback
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
                    cleanRefreshBtn.style.color = FEEDBACK_COLOR; // visual feedback
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
            cache: true,
            cacheStorage: true,
            downloads: true,
            formData: true,
            history: true,
            indexedDB: true,
            localStorage: true,
            serviceWorkers: true
        },
        () => {
            if (api.runtime.lastError) {
                console.error(api.runtime.lastError.message);
                return;
            }
            clearBtn.style.color = FEEDBACK_COLOR; // visual feedback
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

let activeCtxMenu = null; // reference to the currently visible menu

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
        { label: T.ctxOpen, action: "open" },
        { label: T.ctxNewTab, action: "tab", hint: T.ctxNewTabHint },
        { label: T.ctxNewWindow, action: "window" },
        { label: T.ctxIncognito, action: "incognito" },
        null,
        { label: T.ctxCopyUrl, action: "copy" },
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
            ev.stopPropagation(); // prevent immediate menu close
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

    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 4;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 4;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

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

    let ref = folderEl; // insertion reference: each new element goes after this one

    for (const node of nodes) {
        parentMap.set(node.id, folderId);

        const el = node.url
        ? createBookmarkItem(node, level)
        : createFolderItem(node, level);

        // Tag the element so we can find and remove it later
        el.dataset.parentFolder = folderId;
        ref.insertAdjacentElement("afterend", el);
        void el.offsetHeight; // force reflow so the browser registers the element before adding the animation class
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
    div.style.paddingLeft = `${10 + level * 18}px`; // indent proportional to depth
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", node.title || node.url);
    div.setAttribute("tabindex", "0");

    const img = document.createElement("img");
    img.className = "icon";
    img.alt = "";
    img.src = getFavicon(node.url);

    const span = document.createElement("span");
    span.className = "title";
    span.textContent = node.title || node.url; // fall back to URL if title is empty

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
    span.textContent = node.title || T.folder; // localized fallback for unnamed folders

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


/* ── List rendering (bookmarks) ───────────────────────────────────────────── */

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
        parentMap.set(node.id, folderId); // record parentage for ancestry detection

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

// Full render — called when switching to the bookmarks tab
async function render() {
    list.innerHTML = "";
    pathEl.textContent = manifest.name;
    await renderFolder(ROOT_FOLDER_ID, list);
}


/* ── History rendering ────────────────────────────────────────────────────── */

/**
 * Return a locale-aware day label for a given timestamp.
 * Produces "Today", "Yesterday", or a formatted date string.
 *
 * @param {Date} date
 * @returns {string}
 */
function historyDayLabel(date) {
    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (date.toDateString() === todayStr) return T.historyToday;
    if (date.toDateString() === yesterday.toDateString()) return T.historyYesterday;

    return date.toLocaleDateString(navigator.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
}

/**
 * Create a DOM element for a history entry.
 * Reuses the same .item / .icon / .title structure as bookmarks so the
 * existing keyboard navigation and accent-hover styles work automatically.
 *
 * @param {chrome.history.HistoryItem} item
 * @returns {HTMLElement}
 */
function createHistoryItem(item) {
    const div = document.createElement("div");
    div.className = "item bookmark";
    div.dataset.type = "bookmark"; // reuse bookmark semantics for keyboard nav
    div.dataset.url = item.url;
    div.setAttribute("role", "button");
    div.setAttribute("aria-label", item.title || item.url);
    div.setAttribute("tabindex", "0");

    const img = document.createElement("img");
    img.className = "icon";
    img.alt = "";
    img.src = getFavicon(item.url);

    const span = document.createElement("span");
    span.className = "title";
    span.textContent = item.title || item.url;

    const time = document.createElement("span");
    time.className = "history-time";
    time.textContent = new Date(item.lastVisitTime).toLocaleTimeString(navigator.language, {
        hour: "2-digit",
        minute: "2-digit",
    });

    div.appendChild(img);
    div.appendChild(span);
    div.appendChild(time);

    // Left-click: open in current tab; Ctrl+Click: open in a new tab
    div.addEventListener("click", (e) => {
        if (e.ctrlKey) {
            api.tabs.create({ url: item.url, active: true }, () => window.close());
            return;
        }
        api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return;
            api.tabs.update(tab.id, { url: item.url, active: true }, () => {
                api.windows.update(tab.windowId, { focused: true }, () => window.close());
            });
        });
    });

    div.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            div.click();
        }
    });

    // Right-click: reuse the same context menu as bookmarks.
    // cleanUrl strips tracking parameters before they reach the copy action.
    div.addEventListener("contextmenu", (e) => showContextMenu(e, cleanUrl(item.url)));

    return div;
}

/**
 * Fetch browser history and render it grouped by calendar day.
 * Uses chrome.history.search — requires the "history" permission.
 */
function renderHistory() {
    list.innerHTML = "";

    const startTime = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;

    api.history.search({ text: "", maxResults: HISTORY_MAX_RESULTS, startTime }, (items) => {
        if (api.runtime.lastError) {
            console.error("History fetch failed:", api.runtime.lastError.message);
            return; // leave the list empty rather than showing a misleading "no history" message
        }

        if (!items || items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "history-empty";
            empty.textContent = T.historyEmpty;
            list.appendChild(empty);
            return;
        }

        // Group entries by calendar day.
        // Key: "YYYY-M-D" string (locale-independent, for deduplication).
        const groups = new Map();
        for (const item of items) {
            const d = new Date(item.lastVisitTime);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!groups.has(key)) {
                groups.set(key, { label: historyDayLabel(d), items: [] });
            }
            groups.get(key).items.push(item);
        }

        for (const { label, items: dayItems } of groups.values()) {
            // Day separator header
            const header = document.createElement("div");
            header.className = "history-day-header";
            header.textContent = label;
            list.appendChild(header);

            for (const item of dayItems) {
                const el = createHistoryItem(item);
                el.classList.add("item--animate");
                list.appendChild(el);
            }
        }
    });
}


/* ── Tab switching ────────────────────────────────────────────────────────── */

/**
 * Switch the visible panel between "bookmarks" and "history".
 * Resets keyboard selection and updates ARIA states on the tab buttons.
 *
 * @param {"bookmarks"|"history"} tab
 */
function switchTab(tab) {
    activeTab = tab;
    selectedIndex = -1;
    closeContextMenu();

    const isBookmarks = tab === "bookmarks";

    tabBookmarksBtn.classList.toggle("active", isBookmarks);
    tabBookmarksBtn.setAttribute("aria-selected", String(isBookmarks));

    tabHistoryBtn.classList.toggle("active", !isBookmarks);
    tabHistoryBtn.setAttribute("aria-selected", String(!isBookmarks));

    if (isBookmarks) {
        render();
    } else {
        renderHistory();
    }
}

tabBookmarksBtn.addEventListener("click", () => switchTab("bookmarks"));
tabHistoryBtn.addEventListener("click", () => switchTab("history"));


/* ── Keyboard navigation ──────────────────────────────────────────────────── */

document.addEventListener("keydown", (e) => {
    // If the context menu is open, only Escape is handled
    if (activeCtxMenu) {
        if (e.key === "Escape") closeContextMenu();
        return;
    }

    const items = getItems();
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

    // ArrowRight: open the selected folder (bookmarks tab only)
    if (e.key === "ArrowRight" && current?.dataset.type === "folder" && !current.classList.contains("open")) {
        e.preventDefault();
        current.click();
    }

    // ArrowLeft: close the selected folder (bookmarks tab only)
    if (e.key === "ArrowLeft" && current?.dataset.type === "folder" && current.classList.contains("open")) {
        e.preventDefault();
        current.click();
    }
});


/* ── Entry point ──────────────────────────────────────────────────────────── */

render();
