// Which design tokens an element uses, and which elements use a token (the tweak panel's Pick).
// The browser only gives final values, so this reads the page's stylesheets instead: the rules
// that apply to an element still say var(--color-border). For an element it takes:
//   - every rule that matches it, its ::before and ::after, and (with `states`) its :hover,
//     :focus and :active looks too;
//   - its inline style;
//   - from its parents, what it inherits: text colour, font, sizes, and custom properties;
// collects the var(--...) in them, and follows a component's own variables (--edge:
// var(--color-border)) back to the tokens.

const STATES = /:(hover|focus-visible|focus-within|focus|active)\b/g;
const PSEUDO_ELEMENTS = /::?(before|after|backdrop|placeholder|marker|selection|-webkit-[\w-]+|-moz-[\w-]+)\b/g;
const INHERITED = /^(color|font|font-[\w-]+|line-height|letter-spacing|text-[\w-]+|word-spacing|white-space|visibility|cursor|caret-color|accent-color|color-scheme|--[\w-]+)$/;
const VAR = /var\(\s*(--[\w-]+)/g;

// Every style rule on the page that applies now (media queries that match, supports that hold).
function styleRules(): CSSStyleRule[] {
  const found: CSSStyleRule[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) { found.push(rule); if (rule.cssRules?.length) walk(rule.cssRules); }
      else if (rule instanceof CSSMediaRule) { if (matchMedia(rule.conditionText).matches) walk(rule.cssRules); }
      else if (rule instanceof CSSSupportsRule) { if (CSS.supports(rule.conditionText)) walk(rule.cssRules); }
      else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules); } catch { /* another origin's sheet: can't be read, and isn't ours */ }
  }
  return found;
}

// A selector as something matches() can test: without pseudo-elements, and without states when
// `states` (so a :hover look counts as the element's). Empty if nothing is left.
function testable(selector: string, states: boolean): string {
  let base = selector.replace(PSEUDO_ELEMENTS, "");
  if (states) base = base.replace(STATES, "");
  return base.trim();
}

function matches(element: Element, selectorText: string, states: boolean): boolean {
  return selectorText.split(",").some((part) => {
    const base = testable(part, states);
    if (!base) return false;
    try { return element.matches(base); } catch { return false; }
  });
}

// The declarations of a rule or a style attribute, as written (shorthands keep their var()).
function declarations(cssText: string): [string, string][] {
  const body = cssText.includes("{") ? cssText.slice(cssText.indexOf("{") + 1, cssText.lastIndexOf("}")) : cssText;
  return [...body.matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2]]);
}

function refs(value: string): string[] {
  return [...value.matchAll(VAR)].map((m) => m[1]);
}

// The tokens (names in `known`) the element uses.
export function tokensUsedBy(element: Element, known: ReadonlySet<string>, { states = true } = {}): Set<string> {
  const used = new Set<string>();
  const wanted: string[] = [];
  const locals = new Map<string, string[]>();   // a component's own variable: what it refers to
  const take = (cssText: string, onlyInherited: boolean) => {
    for (const [property, value] of declarations(cssText)) {
      if (onlyInherited && !INHERITED.test(property)) continue;
      const names = refs(value);
      if (property.startsWith("--")) { if (!known.has(property)) locals.set(property, [...(locals.get(property) ?? []), ...names]); }
      else wanted.push(...names);
    }
  };
  const rules = styleRules();
  for (let node: Element | null = element, own = true; node; node = node.parentElement, own = false) {
    for (const rule of rules) if (matches(node, rule.selectorText, states)) take(rule.cssText, !own);
    const inline = node.getAttribute("style");
    if (inline) take(inline, !own);
  }
  const seen = new Set<string>();
  while (wanted.length) {
    const name = wanted.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    if (known.has(name)) used.add(name);
    else wanted.push(...(locals.get(name) ?? []));
  }
  return used;
}

// The elements inside `scope` whose own rules or inline style use the token, directly or through a
// component's own variable. For outlining them.
export function elementsUsing(token: string, scope: Element, { limit = 300 } = {}): Element[] {
  const rules = styleRules();
  const via = new Set([token]);
  // Component variables that refer to it, at any depth.
  for (let grew = true; grew;) {
    grew = false;
    for (const rule of rules) for (const [property, value] of declarations(rule.cssText)) {
      if (property.startsWith("--") && !via.has(property) && refs(value).some((name) => via.has(name))) { via.add(property); grew = true; }
    }
  }
  const uses = (cssText: string) => declarations(cssText).some(([property, value]) => !property.startsWith("--") && refs(value).some((name) => via.has(name)));
  const found = new Set<Element>();
  for (const rule of rules) {
    if (!uses(rule.cssText)) continue;
    for (const part of rule.selectorText.split(",")) {
      const base = testable(part, true);
      if (!base) continue;
      try { scope.querySelectorAll(base).forEach((element) => found.add(element)); } catch { /* a selector querySelectorAll can't take */ }
      if (found.size >= limit) return [...found];
    }
  }
  scope.querySelectorAll("[style]").forEach((element) => { if (uses(element.getAttribute("style") ?? "")) found.add(element); });
  return [...found].slice(0, limit);
}

// What a picked element is called in the panel: its tag and first class, and the specimen it's in.
export function describe(element: Element): string {
  const cls = [...element.classList].find((name) => !name.startsWith("is-"));
  const own = `${element.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;
  const specimen = element.closest("figure")?.querySelector(".ds-label")?.textContent;
  return specimen ? `${own} in ${specimen}` : own;
}
