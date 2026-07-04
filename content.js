const TWIMG_HOST = "video.twimg.com";
const EROZINE_HOSTS = new Set(["erozine.jp", "www.erozine.jp"]);
const OVERLAY_ID = "__twimg_inline_video_overlay__";
const AUTO_PLAY_NEXT_KEY = "autoPlayNext";
let overlayCleanup = null;

function parsePlayableUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value, location.href);
    if (url.hostname === TWIMG_HOST) {
      return url.href;
    }

    if (url.hostname.endsWith(".twimg.com") && /\.(mp4|m3u8)$/i.test(url.pathname)) {
      return url.href;
    }

    if (EROZINE_HOSTS.has(url.hostname) && /^\/x\/a\/[^/]+\/?$/.test(url.pathname)) {
      return url.href;
    }

    return null;
  } catch {
    return null;
  }
}

function isDirectVideoUrl(value) {
  try {
    const url = new URL(value, location.href);
    return url.hostname === TWIMG_HOST
      || (url.hostname.endsWith(".twimg.com") && /\.(mp4|m3u8)$/i.test(url.pathname));
  } catch {
    return false;
  }
}

function candidatesFromElement(element) {
  const values = [];

  for (let current = element; current && current !== document; current = current.parentElement) {
    if (current.href) values.push(current.href);
    if (current.src) values.push(current.src);

    for (const key of ["url", "href", "video", "videoUrl", "src", "target"]) {
      if (current.dataset?.[key]) {
        values.push(current.dataset[key]);
      }
    }

    for (const attribute of current.attributes || []) {
      values.push(attribute.value);
    }
  }

  return values;
}

function findTwimgUrl(event) {
  const path = event.composedPath ? event.composedPath() : [];

  for (const target of path) {
    if (!(target instanceof Element)) {
      continue;
    }

    for (const value of candidatesFromElement(target)) {
      const url = parsePlayableUrl(value);
      if (url) {
        return url;
      }
    }
  }

  return null;
}

function uniqueUrls(values) {
  return [...new Set(values.filter(Boolean))];
}

function getAutoPlayNextSetting() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [AUTO_PLAY_NEXT_KEY]: true }, (result) => {
      if (chrome.runtime.lastError) {
        resolve(true);
        return;
      }

      resolve(Boolean(result[AUTO_PLAY_NEXT_KEY]));
    });
  });
}

function saveAutoPlayNextSetting(value) {
  chrome.storage.local.set({ [AUTO_PLAY_NEXT_KEY]: value });
}

function collectPageVideoUrls(activeUrl) {
  const selectors = [
    "a[href]",
    "video[src]",
    "source[src]",
    "img[src]",
    "[data-url]",
    "[data-href]",
    "[data-video]",
    "[data-video-url]",
    "[data-src]",
    "[data-target]"
  ].join(",");
  const urls = [];

  for (const element of document.querySelectorAll(selectors)) {
    for (const value of candidatesFromElement(element)) {
      const url = parsePlayableUrl(value);
      if (url) {
        urls.push(url);
      }
    }
  }

  const playlist = uniqueUrls(urls);
  if (activeUrl && !playlist.includes(activeUrl)) {
    playlist.push(activeUrl);
  }

  return playlist;
}

function openInline(event) {
  if (event.defaultPrevented || event.button > 1) {
    return;
  }

  const url = findTwimgUrl(event);
  if (!url) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({
    type: "openTwimgInline",
    url,
    playlist: collectPageVideoUrls(url)
  });
}

function removeOverlay() {
  if (overlayCleanup) {
    overlayCleanup();
    overlayCleanup = null;
  }

  document.getElementById(OVERLAY_ID)?.remove();
}

async function showOverlay(url, playlist = []) {
  removeOverlay();

  let urls = uniqueUrls(Array.isArray(playlist) ? playlist : []);
  let currentIndex = urls.indexOf(url);
  if (currentIndex === -1) {
    urls.push(url);
    currentIndex = urls.length - 1;
  }
  let autoPlayNext = await getAutoPlayNextSetting();

  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      color-scheme: dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .backdrop {
      box-sizing: border-box;
      display: grid;
      place-items: center;
      width: 100vw;
      height: 100vh;
      padding: 22px;
      background: rgba(7, 9, 14, 0.9);
      backdrop-filter: blur(8px) saturate(1.1);
    }

    .bar {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 1;
      display: flex;
      gap: 8px;
    }

    button {
      box-sizing: border-box;
      width: 40px;
      height: 40px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: rgba(22, 27, 38, 0.78);
      color: #fff;
      cursor: pointer;
      font: 700 18px/1 system-ui, sans-serif;
      opacity: 0.86;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
      transition: opacity 0.16s ease, background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
    }

    button:hover {
      border-color: rgba(78, 161, 255, 0.56);
      background: rgba(43, 52, 69, 0.96);
      opacity: 1;
      transform: translateY(-1px);
    }

    .stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .side-close {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      min-width: 0;
      cursor: pointer;
    }

    .side-close.left {
      justify-content: flex-end;
      padding-right: 14px;
    }

    .side-close.right {
      justify-content: flex-start;
      padding-left: 14px;
    }

    .nav-button {
      position: fixed;
      top: 50%;
      z-index: 1;
      width: 46px;
      height: 56px;
      font-size: 30px;
      transform: translateY(-50%);
    }

    .nav-button.prev {
      left: 16px;
    }

    .nav-button.next {
      right: 16px;
    }

    .nav-button:hover {
      transform: translateY(-50%) scale(1.02);
    }

    .nav-button:active,
    .nav-button:disabled {
      transform: translateY(-50%);
    }

    .mode-button {
      width: auto;
      min-width: 40px;
      padding: 0 10px;
      font-size: 13px;
    }

    iframe {
      display: block;
      width: min(94vw, 1440px);
      height: min(88vh, 900px);
      background: #000;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      box-shadow: 0 26px 86px rgba(0, 0, 0, 0.64);
    }

    @media (max-width: 720px) {
      .backdrop {
        padding: 8px;
      }

      .bar {
        top: 10px;
        right: 10px;
      }

      iframe {
        width: 100%;
        height: 86vh;
      }

      .side-close.left,
      .side-close.right {
        padding: 0 6px;
      }

      .nav-button {
        left: auto;
        right: auto;
        width: 38px;
        height: 48px;
      }

      .nav-button.prev {
        left: 10px;
      }

      .nav-button.next {
        right: 10px;
      }
    }
  `;

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";

  const bar = document.createElement("div");
  bar.className = "bar";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "\u00d7";
  close.title = "关闭";
  close.setAttribute("aria-label", "关闭");
  close.addEventListener("click", removeOverlay);

  const endMode = document.createElement("button");
  endMode.type = "button";
  endMode.className = "mode-button";

  const stage = document.createElement("div");
  stage.className = "stage";

  const leftClose = document.createElement("div");
  leftClose.className = "side-close left";
  leftClose.title = "关闭";
  leftClose.addEventListener("click", (event) => {
    if (event.target === leftClose) {
      removeOverlay();
    }
  });

  const rightClose = document.createElement("div");
  rightClose.className = "side-close right";
  rightClose.title = "关闭";
  rightClose.addEventListener("click", (event) => {
    if (event.target === rightClose) {
      removeOverlay();
    }
  });

  const frame = document.createElement("iframe");
  frame.allow = "autoplay; fullscreen";
  frame.title = "CDN inline media player";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "nav-button prev";
  prev.textContent = "<";
  prev.title = "Previous video";
  prev.setAttribute("aria-label", "Previous video");

  const next = document.createElement("button");
  next.type = "button";
  next.className = "nav-button next";
  next.textContent = ">";
  next.title = "Next video";
  next.setAttribute("aria-label", "Next video");

  let navigationToken = 0;
  let resolving = false;

  function viewerUrl(nextUrl, resolveError = false) {
    const params = new URLSearchParams({
      embed: "1",
      src: nextUrl,
      autoNext: autoPlayNext ? "1" : "0"
    });
    if (resolveError) {
      params.set("error", "resolve");
    }

    return chrome.runtime.getURL(`viewer.html?${params.toString()}`);
  }

  function updateEndModeButton() {
    endMode.textContent = autoPlayNext ? "Next" : "Loop";
    endMode.title = autoPlayNext ? "End: play next video" : "End: loop current video";
    endMode.setAttribute("aria-label", endMode.title);
  }

  function resolveVideoUrl(nextUrl) {
    if (isDirectVideoUrl(nextUrl)) {
      return Promise.resolve({ url: nextUrl, pending: false });
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "resolveTwimgUrl", url: nextUrl }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ url: null, pending: false });
          return;
        }

        if (response?.ok && response.url) {
          resolve({ url: response.url, pending: false });
          return;
        }

        chrome.runtime.sendMessage({
          type: "openTwimgInline",
          url: nextUrl,
          playlist: urls
        });
        resolve({ url: null, pending: true });
      });
    });
  }

  async function setFrameUrl(nextUrl) {
    const token = ++navigationToken;
    resolving = true;
    updateNavButtons();

    const resolved = await resolveVideoUrl(nextUrl);
    if (token !== navigationToken) {
      return;
    }

    resolving = false;
    if (resolved.url) {
      urls[currentIndex] = resolved.url;
      frame.src = viewerUrl(resolved.url);
    } else if (!resolved.pending) {
      frame.src = viewerUrl(nextUrl, true);
    }

    updateNavButtons();
  }

  function updateNavButtons() {
    const disabled = resolving || urls.length < 2;
    prev.disabled = disabled;
    next.disabled = disabled;
  }

  function moveVideo(offset) {
    if (resolving || urls.length < 2) {
      return;
    }

    currentIndex = (currentIndex + offset + urls.length) % urls.length;
    setFrameUrl(urls[currentIndex]);
    updateNavButtons();
    frame.focus();
  }

  prev.addEventListener("click", (event) => {
    event.stopPropagation();
    moveVideo(-1);
  });
  next.addEventListener("click", (event) => {
    event.stopPropagation();
    moveVideo(1);
  });
  endMode.addEventListener("click", () => {
    autoPlayNext = !autoPlayNext;
    saveAutoPlayNextSetting(autoPlayNext);
    updateEndModeButton();
    frame.contentWindow?.postMessage({
      type: "twimgInlineSetAutoNext",
      autoNext: autoPlayNext
    }, "*");
  });

  updateEndModeButton();
  setFrameUrl(urls[currentIndex]);
  updateNavButtons();

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      removeOverlay();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveVideo(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveVideo(1);
    }
  };
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) {
      return;
    }

    if (event.data?.type === "twimgInlineClose") {
      removeOverlay();
    } else if (event.data?.type === "twimgInlineEnded" && autoPlayNext) {
      moveVideo(1);
    }
  };
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("message", onMessage);
  overlayCleanup = () => {
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("message", onMessage);
  };

  bar.append(endMode, close);
  leftClose.append(prev);
  rightClose.append(next);
  stage.append(leftClose, frame, rightClose);
  backdrop.append(bar, stage);
  shadow.append(style, backdrop);
  document.documentElement.append(host);
  frame.focus();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "showTwimgOverlay" || !message.url) {
    return;
  }

  showOverlay(message.url, message.playlist);
  sendResponse({ ok: true });
});

document.addEventListener("click", openInline, true);
document.addEventListener("auxclick", openInline, true);
