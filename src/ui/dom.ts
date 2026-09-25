export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function button(text: string, className: string, action: () => void): HTMLButtonElement {
  const element = el("button", className, text);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}

export function link(label: string, href: string): HTMLAnchorElement {
  const anchor = el("a", "", label);
  try {
    const url = new URL(href);
    if (url.origin !== "https://keyframe-staff-list.com" || url.username || url.password || !/^\/(person\/(?:\d+|(?:ja|en):[^/]+)|staff\/[^/]+)\/?$/.test(url.pathname)) return anchor;
    anchor.href = url.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  } catch { /* Render invalid links as text. */ }
  return anchor;
}
