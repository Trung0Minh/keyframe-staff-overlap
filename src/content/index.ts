import { StructuredKeyframeDataSource } from "../data/StructuredKeyframeDataSource.ts";
import type { StorageArea } from "../data/cache.ts";
import { mountPanel } from "../ui/panel.ts";

declare const chrome: { runtime: { getURL(path: string): string }; storage: { local: StorageArea } };

async function mount() {
  if (document.querySelector("[data-kf-overlap-root]")) return;
  const host = document.createElement("div"); host.setAttribute("data-kf-overlap-root", "");
  const shadow = host.attachShadow({ mode: "open" });
  const stylesheet = document.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = chrome.runtime.getURL("ui/styles.css");
  shadow.append(stylesheet); document.documentElement.append(host);
  const source = new StructuredKeyframeDataSource();
  await mountPanel(shadow, source, chrome.storage.local);
  // Watch direct root children only; route-level subtree changes do not need remounting.
  new MutationObserver(() => { if (!host.isConnected) document.documentElement.append(host); })
    .observe(document.documentElement, { childList: true });
}

void mount();
