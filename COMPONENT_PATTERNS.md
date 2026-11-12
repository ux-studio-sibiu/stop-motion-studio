# Component Patterns

Coding patterns for components across the casedeschise workspace.

## Core principles

- **No abstraction layers** — define content directly where it's used, not in separate data files
- **Composition over configuration** — children props are preferred over data-driven props
- **JSX as source of truth** — structure and content live in component markup, not in transformed data
- **Simple state management** — use `cloneElement` for passing state to children rather than complex prop drilling
- **Self-contained over DRY** — when content recurs across pages/variants, duplicate it; don't extract shared content modules. Accept the repetition.
- **Compose from atoms** — build pages from standalone, reorderable pieces (gallery, title, accordion, blurb, link); wrappers like `Panel` are optional shorthand, not mandatory.

## Accordion pattern

### ✅ Do

Define accordion items directly as JSX children using `AccordionItem` components:

```tsx
<Accordion>
  <AccordionItem title="Services">Fast, functional websites...</AccordionItem>
  <AccordionItem title="Design">Less, but better. Minimal design...</AccordionItem>
</Accordion>
```

The `Accordion` component manages open state and passes `isOpen` and `onToggle` to children via `cloneElement`:

```tsx
{childrenArray.map((child, idx) =>
  cloneElement(child as React.ReactElement, {
    isOpen: openIndex === idx,
    onToggle: () => setOpenIndex(openIndex === idx ? null : idx),
  } as any)
)}
```

`AccordionItem` accepts content as `children`, supporting both plain text and HTML strings:

```tsx
export function AccordionItem({ title, children, isOpen, onToggle }: { title: string; children: React.ReactNode; isOpen?: boolean; onToggle?: () => void }) {
  return (
    <li className={`accordion-item${isOpen ? " is-open" : ""}`}>
      <button type="button" className="accordion-trigger" aria-expanded={isOpen} onClick={onToggle}>
        <span className="accordion-title">{title}</span>
        <span className="accordion-icon" aria-hidden="true" />
      </button>
      <div className="accordion-panel" hidden={!isOpen}>
        <p>{typeof children === "string" ? <span dangerouslySetInnerHTML={{ __html: children }} /> : children}</p>
      </div>
    </li>
  );
}
```

### ❌ Don't

Don't define items in a data file and pass them as arrays:

```tsx
// ❌ No
const items = [
  { title: "Services", html: "Fast, functional websites..." },
  { title: "Design", html: "Less, but better..." },
];
<Accordion items={items} />
```

Don't transform data into component props:

```tsx
// ❌ No
const items = content.entries.map((e) => ({
  title: e.title,
  html: e.body,
}));
<Accordion items={items} />
```

## Panel with children pattern

### ✅ Do

Pass children directly to Panel; children are rendered in the wrapped Accordion:

```tsx
<Panel heading="Contact" blurb="Let's talk.">
  <AccordionItem title="Email">contact@example.com</AccordionItem>
  <AccordionItem title="Phone">+1 234 567 8900</AccordionItem>
</Panel>
```

Panel simply wraps children in Accordion and manages layout:

```tsx
export function Panel({ heading, children, blurb }: { heading: string; children: React.ReactNode; blurb: string }) {
  return (
    <div className="nsc-portfolio-panel">
      <h1 className="portfolio-title">{heading}</h1>
      <Accordion>{children}</Accordion>
      <div className="portfolio-footer">
        <p className="portfolio-blurb">{blurb}</p>
      </div>
    </div>
  );
}
```

### ❌ Don't

Don't extract children into arrays or transform them before passing to Accordion.

## Lists of items → children, not array props (general rule)

This is **not** specific to Accordion/Panel — it applies to **every** component
that renders a list of static items. If the items are known at author time,
write them as JSX children. Don't define them in an array and pass that array
as an `items` / `entries` / `links` prop.

This includes navigation, tabs, button groups, cards, menus — anything. There
is **no exception for navigation**: nav links are content, so they are children.

### ✅ Do

```tsx
// site-header.tsx
<NavMenu>
  <NavLink href="/about">Despre</NavLink>
  <NavLink href="/calendar">Calendar</NavLink>
  <NavLink href="/faq">Întrebări frecvente</NavLink>
</NavMenu>
```

The wrapper renders its children and uses `cloneElement` to pass shared state
down (here, a callback to close the menu after a tap):

```tsx
export default function NavMenu({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav className={`nav-menu ${className}`.trim()}>
      <button className="nav-menu-hamburger" onClick={() => setIsOpen(!isOpen)} aria-label="Meniu">…</button>
      <ul className={`nav-menu-list ${isOpen ? "open" : ""}`}>
        {Children.map(children, (child) =>
          isValidElement(child) ? cloneElement(child as React.ReactElement, { onNavigate: () => setIsOpen(false) } as any) : child,
        )}
      </ul>
    </nav>
  );
}
```

Each child owns its own per-item logic (e.g. `NavLink` reads `usePathname` for
its active state) — no per-item config object is threaded through the parent.

### ❌ Don't

```tsx
// ❌ No — array of content passed as a prop, mapped inside the component
const NAV_ITEMS = [
  { label: "Despre", href: "/about" },
  { label: "Calendar", href: "/calendar" },
];
<NavMenu items={NAV_ITEMS} />
```

### The one legitimate exception: dynamic / CMS / async data

When the items come from an async source you cannot inline as JSX — a CMS query,
an API, `await getEvents()` — mapping over the fetched array is correct and
expected. You can't hardcode Sanity content as children. This is the **only**
case where array-driven rendering is fine:

```tsx
// ✅ Fine — items come from Sanity, not the author
const events = await getEvents();
<ul>{events.map((e) => <li key={e._id}>{e.title}</li>)}</ul>
```

## Content organization

### ✅ Do

Define page content directly in the page component:

```tsx
// portfolio/page.tsx
export default function PortfolioPage() {
  return (
    <Composition
      left={<SwiperGallery />}
      right={
        <Panel heading="Portfolio" blurb="...">
          <AccordionItem title="Omotesando Flagship">Retail interior and visual identity...</AccordionItem>
          <AccordionItem title="Kitzbühel Residence">Architectural photography...</AccordionItem>
        </Panel>
      }
    />
  );
}
```

Keep `content.ts` (if it exists at all) limited to genuine **config /
constants** — never content lists. Navigation is content, so it lives as JSX
children in the component that renders it (see *Lists of items → children*
above), not as a `navLinks` array:

```tsx
// content.ts — only true config, e.g.
export const REVALIDATE_SECONDS = 60;
```

### ❌ Don't

Don't maintain separate data exports for page content — including navigation
link arrays. Don't pass content lists as `items` / `links` props.

## Self-contained pages — accept repetition

When the same content appears in more than one place — e.g. the desktop pages
plus a combined **mobile one-pager** — keep each composition **fully
self-contained**. Re-declare the content in each place; do **not** extract a
shared "items" module to DRY it. The repetition is intentional and consistent
with *No abstraction layers*: each page stays independent and editable in place.
The trade-off — syncing the copies when content changes — is accepted.

## Compose pages from atoms

Build a page by composing standalone, reorderable **atoms** directly in the
page/route: gallery, title, accordion group, blurb, contact link. Any atom can
be placed at any point, in any order — drop a `<p className="page-blurb">` or a
`<ContactLink />` wherever the composition wants it.

```tsx
<div className="nsc-mobile-onepager">
  <SwiperGallery />
  <section className="onepager-section"><h1 className="page-title">…</h1><Accordion>…</Accordion></section>
  <p className="page-blurb">A quote, dropped in anywhere.</p>
  <ContactLink />
  …
</div>
```

Wrapper components like `Panel` are **optional shorthand** for a common layout,
not mandatory. Destructure them into atoms when a layout needs a different
arrangement (the mobile one-pager does). When you do, keep the **load-bearing
layout classes single-sourced** — duplicate the content composition, not the
structural CSS skeleton (`.page-panel` flex chain, footer pinning, etc.).

## Rich content slots take `ReactNode`

A content slot that may need markup — a link, emphasis, several lines — takes
`React.ReactNode`, not `string`, so the caller composes the real element:

```tsx
// ✓ the page owns the element, its classes and any links
<Panel blurb={<p className="page-blurb home-intro">… <a href="…">read more</a></p>}>
```

Keep a plain shared base class (`.page-blurb`) and add a per-page variant class
beside it. Prefer this over parsing HTML strings with `dangerouslySetInnerHTML`.

## Accordion open state is per-group

Each `Accordion` owns its own open state. Stacking several accordion groups on a
page gives **independent** per-group state (one item open per group). Don't lift
a single open-index across groups unless a design explicitly calls for it.

## Dual-variant links by breakpoint

A link whose target differs by viewport renders **both** variants, toggled by
the `*-only` show/hide utilities (see STYLE_GUIDE). Example — `ContactLink`
routes to `/contact` on desktop and scrolls to an in-page `#contact` anchor on
the mobile one-pager:

```tsx
export function ContactLink() {
  return (
    <>
      <Link href="/contact" className="page-contact desktop-only"> Contact &rarr;</Link>
      <a href="#contact" className="page-contact mobile-only"> Contact &rarr;</a>
    </>
  );
}
```

## Formatting conventions

### Short JSX props

Single-line formatting for short JSX elements:

```tsx
// ✅ Do
<button type="button" className="accordion-trigger" aria-expanded={isOpen} onClick={onToggle}>
  {title}
</button>

// ❌ Don't
<button
  type="button"
  className="accordion-trigger"
  aria-expanded={isOpen}
  onClick={onToggle}
>
  {title}
</button>
```

### `<Image>` always on one line

`next/image` `<Image>` elements are **always** formatted on a single line,
regardless of how many props they carry:

```tsx
// ✅ Do
<Image src={img.url} alt={title} fill priority sizes="100vw" className="object-cover" placeholder={img.lqip ? "blur" : undefined} blurDataURL={img.lqip} />

// ❌ Don't
<Image
  src={img.url}
  alt={title}
  fill
  priority
  sizes="100vw"
  className="object-cover"
  placeholder={img.lqip ? "blur" : undefined}
  blurDataURL={img.lqip}
/>
```

### Elements with fewer than 4 attributes

Any element with **3 or fewer attributes** is written on a single line too:

```tsx
// ✅ Do
<button className="nav-hamburger" onClick={toggle} aria-label="Meniu">…</button>
<a href={`tel:${phone}`} className="contact-link">{phone}</a>

// ❌ Don't
<button
  className="nav-hamburger"
  onClick={toggle}
  aria-label="Meniu"
>…</button>
```

Elements with **4 or more** attributes may wrap onto multiple lines when the
single line would be too long — but `<Image>` is exempt and stays on one line.
An attribute whose value is itself a multi-statement function is the practical
exception: keep the wrapped form rather than cramming a handler onto one line.

### Function signatures

Single-line destructuring for inline functions:

```tsx
// ✅ Do
export function AccordionItem({ title, children, isOpen, onToggle }: { title: string; children: React.ReactNode; isOpen?: boolean; onToggle?: () => void }) {

// ❌ Don't
export function AccordionItem({
  title,
  children,
  isOpen,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
```

## Flexibility first

### Custom per-item styling

Since AccordionItem accepts `children` as `React.ReactNode`, individual items can have custom markup:

```tsx
<Accordion>
  <AccordionItem title="Simple item">Plain text content</AccordionItem>
  
  <AccordionItem title="Custom layout">
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      <div>Left column</div>
      <div>Right column</div>
    </div>
  </AccordionItem>
  
  <AccordionItem title="With HTML">
    <strong>Bold text</strong> and <em>emphasis</em>
  </AccordionItem>
</Accordion>
```

This flexibility is why children-based composition is preferred: each item can vary in structure without adding conditional logic or polymorphic variants.
