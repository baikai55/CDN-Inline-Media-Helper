const video = document.querySelector("#video");
const status = document.querySelector("#status");
const copyButton = document.querySelector("#copy");
const openButton = document.querySelector("#open");
const playerWrap = document.querySelector(".player-wrap");
const params = new URLSearchParams(location.search);
const src = params.get("src");
const error = params.get("error");
const embed = params.get("embed") === "1";

if (embed) {
  document.body.classList.add("embed");
}

function setStatus(text) {
  status.textContent = text;
}

function isAllowedVideoUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === "video.twimg.com"
      || (url.hostname.endsWith(".twimg.com") && /\.(mp4|m3u8)$/i.test(url.pathname));
  } catch {
    return false;
  }
}

function fitEmbeddedVideo() {
  if (!embed || !playerWrap || !video.videoWidth || !video.videoHeight) {
    return;
  }

  const bounds = playerWrap.getBoundingClientRect();
  const videoRatio = video.videoWidth / video.videoHeight;
  const wrapRatio = bounds.width / bounds.height;

  if (wrapRatio > videoRatio) {
    playerWrap.style.setProperty("--video-height", "100%");
    playerWrap.style.setProperty("--video-width", `${bounds.height * videoRatio}px`);
  } else {
    playerWrap.style.setProperty("--video-width", "100%");
    playerWrap.style.setProperty("--video-height", `${bounds.width / videoRatio}px`);
  }
}

if (error === "resolve") {
  setStatus(`无法从此页面链接解析出 video.twimg.com 视频地址：${src || ""}`);
  if (copyButton) copyButton.disabled = !src;
  if (openButton) openButton.disabled = !src;
} else if (!isAllowedVideoUrl(src)) {
  setStatus("未收到有效的 video.twimg.com 视频地址。");
  if (copyButton) copyButton.disabled = true;
  if (openButton) openButton.disabled = true;
} else {
  video.src = src;
  setStatus(src);
}

video.addEventListener("error", () => {
  setStatus("视频加载失败，链接可能已过期或无法直接播放。");
});

video.addEventListener("loadedmetadata", fitEmbeddedVideo);
window.addEventListener("resize", fitEmbeddedVideo);

if (embed && playerWrap) {
  playerWrap.addEventListener("click", (event) => {
    if (event.target !== playerWrap) {
      return;
    }

    const videoBounds = video.getBoundingClientRect();
    const isSideArea = event.clientX < videoBounds.left || event.clientX > videoBounds.right;
    if (isSideArea) {
      window.parent.postMessage({ type: "twimgInlineClose" }, "*");
    }
  });
}

if (copyButton) {
  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(src);
    setStatus("链接已复制。");
  });
}

if (openButton) {
  openButton.addEventListener("click", () => {
    chrome.tabs.create({ url: src });
  });
}
