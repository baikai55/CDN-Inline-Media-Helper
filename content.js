const TWIMG_HOST = "video.twimg.com";
const EROZINE_HOSTS = new Set(["erozine.jp", "www.erozine.jp"]);
const OVERLAY_ID = "__twimg_inline_video_overlay__";
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
  chrome.runtime.sendMessage({ type: "openTwimgInline", url });
}

function removeOverlay() {
  if (overlayCleanup) {
    overlayCleanup();
    overlayCleanup = null;
  }

  document.getElementById(OVERLAY_ID)?.remove();
}

function showOverlay(url) {
  removeOverlay();

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
      width: 100%;
      height: 100%;
      min-width: 0;
      cursor: pointer;
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

  const stage = document.createElement("div");
  stage.className = "stage";

  const leftClose = document.createElement("div");
  leftClose.className = "side-close";
  leftClose.title = "关闭";
  leftClose.addEventListener("click", removeOverlay);

  const rightClose = document.createElement("div");
  rightClose.className = "side-close";
  rightClose.title = "关闭";
  rightClose.addEventListener("click", removeOverlay);

  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL(`viewer.html?embed=1&src=${encodeURIComponent(url)}`);
  frame.allow = "autoplay; fullscreen";
  frame.title = "Twitter/X video player";

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      removeOverlay();
    }
  };
  const onMessage = (event) => {
    if (event.source === frame.contentWindow && event.data?.type === "twimgInlineClose") {
      removeOverlay();
    }
  };
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("message", onMessage);
  overlayCleanup = () => {
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("message", onMessage);
  };

  bar.append(close);
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

  showOverlay(message.url);
  sendResponse({ ok: true });
});

document.addEventListener("click", openInline, true);
document.addEventListener("auxclick", openInline, true);
