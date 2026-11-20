"use client";

import { Children, cloneElement, isValidElement, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";

// The one panel beside the stage, split into tabs picked from a column of icons on its left
// edge. Each tab is a <PanelTab> child, so adding one (later steps will) is adding a child:
//
//   <SidePanel>
//     <PanelTab id="camera" label="Camera" icon={<Camera />}>…</PanelTab>
//     <PanelTab id="picture" label="Picture" icon={<Image />}>…</PanelTab>
//   </SidePanel>
//
// Which tab is open is the caller's (`active`, `onChange`): the studio keeps it in the editor
// store, so the stage can show that tab's tools, and it's remembered across reloads. An unknown
// or missing `active` opens the first tab. The icons are a vertical tab list: click one, or use
// the up and down arrows once it has the keyboard.
export function SidePanel({ children, active: wanted, onChange }: { children: ReactNode; active: string | null; onChange: (id: string) => void }) {
  const tabs = Children.toArray(children).filter(isValidElement) as ReactElement<PanelTabProps>[];
  const active = tabs.some((tab) => tab.props.id === wanted) ? wanted : tabs[0]?.props.id;
  const setChosen = onChange;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.props.id === active);
    const next = tabs[(index + step + tabs.length) % tabs.length].props.id;
    setChosen(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <aside className="nsc-side-panel" aria-label="Tools" style={{ "--tab-count": tabs.length } as CSSProperties}>
      <div className="tabs" role="tablist" aria-orientation="vertical" aria-label="Panels" onKeyDown={onKeyDown}>
        {tabs.map(({ props }) => (
          <button key={props.id} id={tabId(props.id)} type="button" role="tab" className={`tab${props.id === active ? " is-active" : ""}`} aria-selected={props.id === active} aria-controls={panelId(props.id)} aria-label={props.label} title={props.label} tabIndex={props.id === active ? 0 : -1} onClick={() => setChosen(props.id)}>
            {props.icon}
          </button>
        ))}
      </div>
      {tabs.map((tab) => cloneElement(tab, { key: tab.props.id, active: tab.props.id === active }))}
    </aside>
  );
}

// label: the tab's short name (its tooltip and what screen readers say); title: the heading inside,
// when it should say more than the label.
type PanelTabProps = { id: string; label: string; title?: string; icon: ReactNode; active?: boolean; children: ReactNode };

// One tab's content, with its title. Hidden (not removed) while another tab is open, so it keeps
// its state.
export function PanelTab({ id, label, title = label, active = false, children }: PanelTabProps) {
  return (
    <section id={panelId(id)} role="tabpanel" aria-labelledby={tabId(id)} className="panel" hidden={!active}>
      <h2 className="panel-title">{title}</h2>
      {children}
    </section>
  );
}

const tabId = (id: string) => `panel-tab-${id}`;
const panelId = (id: string) => `panel-${id}`;
