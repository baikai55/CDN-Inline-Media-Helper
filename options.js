const CUSTOM_SITES_KEY = "customSites";
const DEFAULT_SITES = [
  "twivideo.net",
  "twidouga.net",
  "erozine.jp"
];

const form = document.querySelector("#addForm");
const input = document.querySelector("#siteInput");
const status = document.querySelector("#status");
const defaultSites = document.querySelector("#defaultSites");
const customSites = document.querySelector("#customSites");
let cachedSites = [];

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

function setStatus(text) {
  status.textContent = text;
}

function normalizeHost(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请输入域名。");
  }

  const withoutWildcard = trimmed.replace(/^\*\./, "");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutWildcard)
    ? withoutWildcard
    : `https://${withoutWildcard}`;
  const url = new URL(withScheme);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http 或 https 站点。");
  }

  if (!url.hostname || url.hostname.includes("*")) {
    throw new Error("域名格式不正确。");
  }

  return url.hostname.toLowerCase();
}

function unique(values) {
  return [...new Set(values)];
}

function buildMatches(host) {
  const hosts = [host];
  if (host.startsWith("www.")) {
    hosts.push(host.slice(4));
  }

  const patterns = [];
  for (const item of hosts) {
    patterns.push(`https://${item}/*`);
    patterns.push(`http://${item}/*`);

    if (!/^\d+\.\d+\.\d+\.\d+$/.test(item) && !item.includes(":")) {
      patterns.push(`https://*.${item}/*`);
      patterns.push(`http://*.${item}/*`);
    }
  }

  return unique(patterns);
}

function siteFromInput(value) {
  const normalized = normalizeHost(value);
  const host = normalized.startsWith("www.") ? normalized.slice(4) : normalized;
  return {
    host,
    matches: buildMatches(host),
    addedAt: Date.now()
  };
}

function isDefaultSite(host) {
  return DEFAULT_SITES.includes(host) || (host.startsWith("www.") && DEFAULT_SITES.includes(host.slice(4)));
}

async function getSites() {
  const result = await chromeCall((done) => chrome.storage.local.get({ [CUSTOM_SITES_KEY]: [] }, done));
  return Array.isArray(result[CUSTOM_SITES_KEY]) ? result[CUSTOM_SITES_KEY] : [];
}

async function saveSites(sites) {
  await chromeCall((done) => chrome.storage.local.set({ [CUSTOM_SITES_KEY]: sites }, done));
  await chromeCall((done) => chrome.runtime.sendMessage({ type: "syncCustomSites" }, done));
}

function renderDefaultSites() {
  defaultSites.replaceChildren(...DEFAULT_SITES.map((host) => {
    const item = document.createElement("li");
    item.className = "site-item";

    const main = document.createElement("span");
    main.className = "site-main";

    const title = document.createElement("span");
    title.className = "site-host";
    title.textContent = host;

    const meta = document.createElement("span");
    meta.className = "site-meta";
    meta.textContent = "内置支持";

    main.append(title, meta);
    item.append(main);
    return item;
  }));
}

function renderCustomSites(sites) {
  if (sites.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "暂无自定义站点。";
    customSites.replaceChildren(empty);
    return;
  }

  customSites.replaceChildren(...sites.map((site) => {
    const item = document.createElement("li");
    item.className = "site-item";

    const main = document.createElement("span");
    main.className = "site-main";

    const title = document.createElement("span");
    title.className = "site-host";
    title.textContent = site.host;

    const meta = document.createElement("span");
    meta.className = "site-meta";
    meta.textContent = `${site.matches.length} 条匹配规则`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "删除";
    remove.addEventListener("click", () => removeSite(site.host));

    main.append(title, meta);
    item.append(main, remove);
    return item;
  }));
}

async function render() {
  renderDefaultSites();
  cachedSites = await getSites();
  renderCustomSites(cachedSites);
}

async function addSite(event) {
  event.preventDefault();

  let site;
  try {
    site = siteFromInput(input.value);
  } catch (error) {
    setStatus(error.message);
    return;
  }

  if (isDefaultSite(site.host) || cachedSites.some((item) => item.host === site.host)) {
    setStatus("这个站点已经在支持列表里。");
    input.select();
    return;
  }

  chrome.permissions.request({ origins: site.matches }, async (granted) => {
    if (!granted) {
      setStatus("没有授予该站点权限。");
      return;
    }

    const latest = await getSites();
    if (!latest.some((item) => item.host === site.host)) {
      await saveSites([...latest, site].sort((a, b) => a.host.localeCompare(b.host)));
    }

    input.value = "";
    setStatus(`已添加 ${site.host}，刷新目标网页后生效。`);
    await render();
  });
}

async function removeSite(host) {
  const sites = await getSites();
  const site = sites.find((item) => item.host === host);
  const next = sites.filter((item) => item.host !== host);

  await saveSites(next);

  if (site?.matches?.length) {
    chrome.permissions.remove({ origins: site.matches }, () => void chrome.runtime.lastError);
  }

  setStatus(`已删除 ${host}。`);
  await render();
}

form.addEventListener("submit", addSite);
render().catch((error) => setStatus(error.message));
