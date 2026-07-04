const VIDEO_HOST = "video.twimg.com";
const EROZINE_HOSTS = new Set(["erozine.jp", "www.erozine.jp"]);
const CUSTOM_SITES_KEY = "customSites";
const CUSTOM_SCRIPT_PREFIX = "custom-site-";
let pendingPlaybackTab = null;
let customSiteSync = Promise.resolve();
const fallbackSourceTabs = new Set();

function chromeCall(invoker) {
  return new Promise((resolve, reject) => {
    invoker((result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(result);
    });
  });
}

function safeScriptId(host) {
  return `${CUSTOM_SCRIPT_PREFIX}${host.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80)}`;
}

async function getCustomSites() {
  const result = await chromeCall((done) => chrome.storage.local.get({ [CUSTOM_SITES_KEY]: [] }, done));
  return Array.isArray(result[CUSTOM_SITES_KEY]) ? result[CUSTOM_SITES_KEY] : [];
}

async function unregisterCustomSiteScripts() {
  const scripts = await chromeCall((done) => chrome.scripting.getRegisteredContentScripts({}, done));
  const ids = scripts
    .map((script) => script.id)
    .filter((id) => id.startsWith(CUSTOM_SCRIPT_PREFIX));

  if (ids.length > 0) {
    await chromeCall((done) => chrome.scripting.unregisterContentScripts({ ids }, done));
  }
}

async function hasSitePermission(matches) {
  try {
    return await chromeCall((done) => chrome.permissions.contains({ origins: matches }, done));
  } catch {
    return false;
  }
}

async function syncCustomSites() {
  const sites = await getCustomSites();
  const scripts = [];

  await unregisterCustomSiteScripts();

  for (const site of sites) {
    if (!site?.host || !Array.isArray(site.matches) || site.matches.length === 0) {
      continue;
    }

    if (!(await hasSitePermission(site.matches))) {
      continue;
    }

    scripts.push({
      id: safeScriptId(site.host),
      matches: site.matches,
      js: ["content.js"],
      runAt: "document_start",
      persistAcrossSessions: true
    });
  }

  if (scripts.length > 0) {
    await chromeCall((done) => chrome.scripting.registerContentScripts(scripts, done));
  }
}

function runCustomSiteSync() {
  customSiteSync = customSiteSync
    .catch(() => undefined)
    .then(syncCustomSites);
  return customSiteSync;
}

function scheduleCustomSiteSync() {
  runCustomSiteSync().catch((error) => console.warn("Failed to sync custom sites:", error));
}

function extractCandidateUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const direct = parseTwimgUrl(value);
  if (direct) {
    return direct;
  }

  const erozine = parseErozineRedirectUrl(value);
  if (erozine) {
    return erozine;
  }

  const twimgMatch = value.match(/https:\/\/video\.twimg\.com\/[^\s"'<>]+/i);
  if (twimgMatch) {
    return parseTwimgUrl(twimgMatch[0]);
  }

  const erozineMatch = value.match(/https:\/\/(?:www\.)?erozine\.jp\/x\/a\/[^\s"'<>]+/i);
  return erozineMatch ? parseErozineRedirectUrl(erozineMatch[0]) : null;
}

function parseTwimgUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname === VIDEO_HOST) {
      return url.href;
    }

    if (url.hostname.endsWith(".twimg.com") && /\.(mp4|m3u8)$/i.test(url.pathname)) {
      return url.href;
    }

    return null;
  } catch {
    return null;
  }
}

function parseErozineRedirectUrl(value) {
  try {
    const url = new URL(value);
    return EROZINE_HOSTS.has(url.hostname) && /^\/x\/a\/[^/]+\/?$/.test(url.pathname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function openViewer(url) {
  const viewerUrl = chrome.runtime.getURL(`viewer.html?src=${encodeURIComponent(url)}`);
  chrome.tabs.create({ url: viewerUrl });
}

function rememberPlaybackTab(tabId) {
  if (Number.isInteger(tabId)) {
    pendingPlaybackTab = {
      tabId,
      expiresAt: Date.now() + 30000
    };
  }
}

function consumePlaybackTab() {
  if (!pendingPlaybackTab || pendingPlaybackTab.expiresAt < Date.now()) {
    pendingPlaybackTab = null;
    return null;
  }

  const { tabId } = pendingPlaybackTab;
  pendingPlaybackTab = null;
  return tabId;
}

function sendOverlayMessage(tabId, url) {
  return new Promise((resolve) => {
    if (!Number.isInteger(tabId)) {
      resolve(false);
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: "showTwimgOverlay", url }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(Boolean(response?.ok));
    });
  });
}

async function injectContentScript(tabId) {
  if (!Number.isInteger(tabId)) {
    return false;
  }

  try {
    await chromeCall((done) => chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    }, done));
    return true;
  } catch {
    return false;
  }
}

async function openInlineOrViewer(url, tabId) {
  if (await sendOverlayMessage(tabId, url)) {
    return;
  }

  if (await injectContentScript(tabId) && await sendOverlayMessage(tabId, url)) {
    return;
  }

  openViewer(url);
}

function getActiveTabId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs?.[0]?.id ?? null);
    });
  });
}

function openErrorViewer(url) {
  const viewerUrl = chrome.runtime.getURL(`viewer.html?src=${encodeURIComponent(url)}&error=resolve`);
  chrome.tabs.create({ url: viewerUrl });
}

function closeFallbackSourceTab(tabId) {
  if (!fallbackSourceTabs.has(tabId)) {
    return;
  }

  fallbackSourceTabs.delete(tabId);
  chrome.tabs.remove(tabId, () => void chrome.runtime.lastError);
}

function openSourceUrl(url, tabId) {
  rememberPlaybackTab(tabId);
  chrome.tabs.create({ url, active: false }, (tab) => {
    if (tab?.id) {
      fallbackSourceTabs.add(tab.id);
      setTimeout(() => closeFallbackSourceTab(tab.id), 30000);
    }
  });
}

async function resolveToTwimgUrl(url) {
  const direct = parseTwimgUrl(url);
  if (direct) {
    return direct;
  }

  if (!parseErozineRedirectUrl(url)) {
    return null;
  }

  for (const options of [
    { method: "HEAD" },
    { method: "GET", headers: { Range: "bytes=0-0" } }
  ]) {
    try {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        credentials: "include",
        redirect: "follow"
      });

      const finalUrl = parseTwimgUrl(response.url);
      if (finalUrl) {
        return finalUrl;
      }

      const contentType = response.headers.get("content-type") || "";
      if (options.method === "GET" && contentType.includes("text/html")) {
        const html = await response.text();
        const embedded = extractCandidateUrl(html);
        if (embedded && parseTwimgUrl(embedded)) {
          return embedded;
        }
      }
    } catch {
      // Try the next resolution method.
    }
  }

  return null;
}

async function openResolvedVideo(url, tabId) {
  const resolved = await resolveToTwimgUrl(url);
  if (resolved) {
    await openInlineOrViewer(resolved, tabId);
  } else if (parseErozineRedirectUrl(url)) {
    openSourceUrl(url, tabId);
  } else {
    openErrorViewer(url);
  }
}

function shouldInterceptDownload(item) {
  const url = parseTwimgUrl(item.finalUrl || item.url);
  if (!url) {
    return null;
  }

  const mime = item.mime || "";
  const filename = item.filename || "";
  const looksLikeVideo = mime.startsWith("video/")
    || /\.(mp4|m3u8)(\?|$)/i.test(url)
    || /\.(mp4|m3u8)$/i.test(filename);

  return looksLikeVideo ? url : null;
}

chrome.downloads.onCreated.addListener((item) => {
  const url = shouldInterceptDownload(item);
  if (!url) {
    return;
  }

  chrome.downloads.cancel(item.id, async () => {
    const tabId = consumePlaybackTab();
    for (const sourceTabId of [...fallbackSourceTabs]) {
      closeFallbackSourceTab(sourceTabId);
    }
    openInlineOrViewer(url, tabId ?? await getActiveTabId());
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  fallbackSourceTabs.delete(tabId);
});

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "open-twimg-inline",
      title: "在线播放 Twitter/X 视频",
      contexts: ["link", "image", "video", "selection", "page"]
    });
  });
}

setupContextMenu();
scheduleCustomSiteSync();
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  scheduleCustomSiteSync();
});
chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
  scheduleCustomSiteSync();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[CUSTOM_SITES_KEY]) {
    scheduleCustomSiteSync();
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = [
    info.linkUrl,
    info.srcUrl,
    info.selectionText,
    info.pageUrl
  ].map(extractCandidateUrl).find(Boolean);

  if (url) {
    openResolvedVideo(url, tab?.id);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "syncCustomSites") {
    runCustomSiteSync()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type !== "openTwimgInline") {
    return;
  }

  const url = extractCandidateUrl(message.url);
  if (url) {
    openResolvedVideo(url, sender.tab?.id).then(() => sendResponse({ ok: true }));
    return true;
  }

  sendResponse({ ok: false });
});
