/* ============================================================================
 *  Eleòra Anchors — Main script
 *  https://github.com/eleora-dev/anchors
 *  License: MIT
 *  ============================================================================ */


/* ── Localisation ─────────────────────────────────────────────────────────── */


// Detect browser language: Italian if it starts with "it", English otherwise
const lang = (navigator.language || "en").toLowerCase().startsWith("it") ? "it" : "en";

const i18n = {
    en: {
        // Navbar button tooltips
        copyUrl:       "Copy a clean version of the current page URL to clipboard (tracking parameters are stripped)",
        cleanRefresh:  "Clear site cache and reload the page",
        clearCache:    "Clear cache, history, downloads and local data (no cookies) for all sites",
        incognito:     "Open a new incognito window",
        bookmarks:     "Open bookmarks manager",
        settings:      "Open browser settings",
        // Footer
        footer: "<a href='https://eleora-dev.github.io/anchors/privacy.html' target='_blank' title='Privacy policy'>Privacy</a><a href='https://github.com/eleora-dev/anchors/blob/main/LICENSE' target='_blank' title='MIT License'>License</a><a href='https://github.com/eleora-dev/anchors' target='_blank' title='Source code on GitHub'>GitHub</a><a href='https://github.com/eleora-dev/anchors/issues' target='_blank' title='Report an issue on GitHub'>Report issue</a>",
        // Misc
        by:            "by",
        folder:        "Folder",         // fallback for unnamed folders
        // Context menu entries
        ctxOpen:       "Open",
        ctxNewTab:     "Open in new tab",
        ctxNewTabHint: "Ctrl+Click",     // shortcut shown on the right
        ctxNewWindow:  "Open in new window",
        ctxIncognito:  "Open in private window",
        ctxCopyUrl:    "Copy URL",
    },
    it: {
        // Navbar button tooltips
        copyUrl:       "Copia una versione pulita dell'URL della pagina corrente negli appunti (eventuali parametri di tracking vengono rimossi)",
        cleanRefresh:  "Pulisci la cache del sito e ricarica la pagina",
        clearCache:    "Elimina cache, cronologia, download e dati locali (cookie esclusi) per tutti i siti",
        incognito:     "Apri una nuova finestra in incognito",
        bookmarks:     "Accedi alla gestione dei preferiti",
        settings:      "Apri le impostazioni del browser",
        // Footer
        footer: "<a href='https://eleora-dev.github.io/anchors/privacy.html' target='_blank' title='Informativa sulla privacy'>Privacy</a><a href='https://github.com/eleora-dev/anchors/blob/main/LICENSE' target='_blank' title='Licenza MIT'>Licenza</a><a href='https://github.com/eleora-dev/anchors' target='_blank' title='Codice sorgente su GitHub'>GitHub</a><a href='https://github.com/eleora-dev/anchors/issues' target='_blank' title='Segnala un problema su GitHub'>Segnala problema</a>",
        // Misc
        by:            "di",
        folder:        "Cartella",       // fallback for unnamed folders
        // Context menu entries
        ctxOpen:       "Apri",
        ctxNewTab:     "Apri in un'altra scheda",
        ctxNewTabHint: "Ctrl+Clic",      // shortcut shown on the right
        ctxNewWindow:  "Apri in una nuova finestra",
        ctxIncognito:  "Apri in una finestra privata",
        ctxCopyUrl:    "Copia URL",
    }
};

// Short alias used throughout the file
const T = i18n[lang];


/* ── Constants ────────────────────────────────────────────────────────────── */

// ID of the Chrome bookmarks root folder ("1" = Bookmarks Bar)
const ROOT_FOLDER_ID = "1";


/* ── DOM references ───────────────────────────────────────────────────────── */

const subtitleEl      = document.getElementById("subtitle");
const list            = document.getElementById("list");
const pathEl          = document.getElementById("path");
const copyBtn         = document.getElementById("copy-url");
const cleanRefreshBtn = document.getElementById("clean-refresh");
const clearBtn        = document.getElementById("clear-cache");
const incognitoBtn    = document.getElementById("incognito");
const bookmarksBtn    = document.getElementById("bookmarks");
const settingsBtn     = document.getElementById("settings");
const footerEl        = document.getElementById("footer");


/* ── State ────────────────────────────────────────────────────────────────── */

const manifest        = chrome.runtime.getManifest();
const expandedFolders = new Set();   // IDs of currently open folders
const parentMap       = new Map();   // childId → parentId, used for navigation

let selectedIndex   = 0;     // index of the keyboard-selected item
let focusedFolderId = null;  // folder to restore focus on after re-render


/* ── Toolbar icon (dark / light) ──────────────────────────────────────────── */

// Update the Chrome toolbar icon based on the active color scheme.
// Runs on every popup open. window.matchMedia is available in the popup
// context but not in a service worker, so this is the correct place for it.
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
chrome.action.setIcon({
    path: {
        "16":  isDark ? "assets/icon-16-dark.png"  : "assets/icon-16.png",
        "32":  isDark ? "assets/icon-32-dark.png"  : "assets/icon-32.png",
        "48":  isDark ? "assets/icon-48-dark.png"  : "assets/icon-48.png",
        "128": isDark ? "assets/icon-128-dark.png" : "assets/icon-128.png"
    }
});


/* ── Apply translations to static UI ─────────────────────────────────────── */

copyBtn.title         = T.copyUrl;
cleanRefreshBtn.title = T.cleanRefresh;
clearBtn.title        = T.clearCache;
incognitoBtn.title    = T.incognito;
bookmarksBtn.title    = T.bookmarks;
settingsBtn.title     = T.settings;

if (footerEl) footerEl.innerHTML = T.footer;

if (subtitleEl && manifest.author) {
    subtitleEl.textContent = `${T.by} ${manifest.author}`;
}


/* ── URL cleaning ─────────────────────────────────────────────────────────── */

// TRACKING_PARAMS is defined in trackers.js, loaded before this script.

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
        if (TRACKING_PARAMS.has(key.toLowerCase())) {
            parsed.searchParams.delete(key);
        }
    }

    // Remove the trailing "?" if no query parameters remain
    return parsed.toString();
}


/* ── Navbar buttons ───────────────────────────────────────────────────────── */

// Copy the active tab URL to the clipboard
copyBtn.onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) return;

        navigator.clipboard.writeText(tab.url).then(() => {
            copyBtn.style.color = "#4caf50";  // green visual feedback
            setTimeout(() => window.close(), 500);
        });
    });
};

// Clear the current site's cache and reload the page
cleanRefreshBtn.onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id || !tab.url) return;

        let origin;
        try {
            origin = new URL(tab.url).origin;
        } catch {
            // Unparseable URL (e.g. chrome://...): reload without clearing
            chrome.tabs.reload(tab.id, { bypassCache: true });
            window.close();
            return;
        }

        chrome.browsingData.remove(
            { origins: [origin] },
            { cache: true, cacheStorage: true },
            () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                }
                chrome.tabs.reload(tab.id, { bypassCache: true }, () => {
                    cleanRefreshBtn.style.color = "#4caf50";  // green visual feedback
                    setTimeout(() => window.close(), 500);
                });
            }
        );
    });
};

// Clear cache, history, downloads and local data for all sites
// Cookies are intentionally excluded to avoid logging the user out of websites
clearBtn.onclick = () => {
    chrome.browsingData.remove(
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
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
            clearBtn.style.color = "#4caf50";  // green visual feedback
            setTimeout(() => window.close(), 500);
        }
    );
};

// Open a new incognito window
incognitoBtn.onclick = () => {
    chrome.windows.create({ incognito: true, state: "maximized" }, () => window.close());
};

// Open Chrome's bookmarks manager
bookmarksBtn.onclick = () => {
    chrome.tabs.create({ url: "chrome://bookmarks/" }, () => window.close());
};

// Open Chrome settings
settingsBtn.onclick = () => {
    chrome.tabs.create({ url: "chrome://settings/" }, () => window.close());
};


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
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab) return;
                chrome.tabs.update(tab.id, { url, active: true }, () => {
                    chrome.windows.update(tab.windowId, { focused: true }, () => {
                        window.close();
                    });
                });
            });
            break;

        case "tab":
            // Open in a new tab
            chrome.tabs.create({ url, active: true }, () => window.close());
            break;

        case "window":
            // Open in a new maximized window
            chrome.windows.create({ url, state: "maximized", focused: true }, () => window.close());
            break;

        case "incognito":
            // Open in a new private window
            chrome.windows.create({ url, incognito: true, state: "maximized", focused: true }, () => window.close());
            break;

        case "copy":
            // Copy the URL to the clipboard
            navigator.clipboard.writeText(url).then(() => window.close());
            break;
    }
}

// Build and show the context menu at the click position
function showContextMenu(e, url) {
    e.preventDefault();
    closeContextMenu();

    const menu = document.createElement("div");
    menu.id = "ctx-menu";

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

// Return the favicon URL for a given page URL
function getFavicon(url) {
    const encodedUrl = encodeURIComponent(url);
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodedUrl}&size=32`;
}

// Promise wrapper for chrome.bookmarks.getChildren
function getChildren(folderId) {
    return new Promise((resolve) => {
        chrome.bookmarks.getChildren(folderId, resolve);
    });
}

// Return all .item elements currently in the DOM
function getItems() {
    return [...document.querySelectorAll(".item")];
}


/* ── Keyboard selection ───────────────────────────────────────────────────── */

// Update the .selected class on the current item and scroll it into view
function updateSelection() {
    const items = getItems();
    items.forEach((item) => item.classList.remove("selected"));

    if (!items.length) return;

    // Clamp index within list bounds
    if (selectedIndex < 0) selectedIndex = 0;
    if (selectedIndex >= items.length) selectedIndex = items.length - 1;

    items[selectedIndex].classList.add("selected");
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
    const nodes = await getChildren(folderId);
    let ref = folderEl;  // insertion reference: each new element goes after this one

    for (const node of nodes) {
        parentMap.set(node.id, folderId);

        const el = node.url
        ? createBookmarkItem(node, level)
        : createFolderItem(node, level);

        // Tag the element so we can find and remove it later
        el.dataset.parentFolder = folderId;

        ref.insertAdjacentElement("afterend", el);
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

    const img = document.createElement("img");
    img.className = "icon";
    img.src = getFavicon(node.url);

    const span = document.createElement("span");
    span.className = "title";
    span.textContent = node.title || node.url;  // fall back to URL if title is empty

    div.appendChild(img);
    div.appendChild(span);

    // Left-click: open in current tab; Ctrl+Click: open in a new tab
    div.addEventListener("click", (e) => {
        if (e.button !== 0) return;

        if (e.ctrlKey) {
            chrome.tabs.create({ url: node.url, active: true }, () => window.close());
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) return;

            chrome.tabs.update(tab.id, { url: node.url, active: true }, () => {
                chrome.windows.update(tab.windowId, { focused: true }, () => {
                    window.close();
                });
            });
        });
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
        focusedFolderId = node.id;

        if (expandedFolders.has(node.id)) {
            // Close: remove children from DOM, update visual state
            removeFolderChildrenFromDOM(node.id);
            expandedFolders.delete(node.id);
            div.classList.remove("open");
            arrow.textContent = "▸";
        } else {
            // Open: close unrelated folders, insert children after this element
            closeUnrelatedFolders(node.id);
            expandedFolders.add(node.id);
            div.classList.add("open");
            arrow.textContent = "▾";
            await insertFolderChildrenIntoDOM(div, node.id, level + 1);
        }

        // Restore selection to this folder
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
    const nodes = await getChildren(folderId);

    for (const node of nodes) {
        parentMap.set(node.id, folderId);  // track parentage for navigation

        const el = node.url
        ? createBookmarkItem(node, level)
        : createFolderItem(node, level);

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
    pathEl.textContent = `${manifest.name}`;
    await renderFolder(ROOT_FOLDER_ID, list);
    updateSelection();
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
        selectedIndex++;
        updateSelection();
    }

    if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex--;
        updateSelection();
    }

    if (e.key === "Enter") {
        e.preventDefault();
        current?.click();
    }

    // ArrowRight: open the selected folder
    if (e.key === "ArrowRight" && current?.dataset.type === "folder") {
        e.preventDefault();
        current.click();
    }

    // ArrowLeft: close the selected folder
    if (e.key === "ArrowLeft" && current?.dataset.type === "folder") {
        e.preventDefault();
        current.click();
    }
});


/* ── Entry point ──────────────────────────────────────────────────────────── */

render();
