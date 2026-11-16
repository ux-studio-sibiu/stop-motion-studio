"use client";

import { Children, cloneElement, isValidElement, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";

// The one panel beside the stage, split into tabs picked from a column of icons on its left
// edge. Each tab is a <PanelTab> child, so adding one (later steps will) is adding a child:
//
//   <SidePanel>
//     <PanelTab id="camera" label="Camera" icon={<Camera />}>…</PanelTab>
//     <PanelTab id="picture" label="Picture" icon={<Image />}>…</PanelTab>
//   </SidePanel>
//
// The first tab is open to start with. The icons are a vertical tab list: click one, or use the
// up and down arrows once it has the keyboard.
export function SidePanel({ children }: { children: ReactNode }) {
  const tabs = Children.toArray(children).filter(isValidElement) as ReactElement<PanelTabProps>[];
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const active = tabs.some((tab) => tab.props.id === chosen) ? chosen : tabs[0]?.props.id;

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
    <aside className="nsc-side-panel" aria-label="Tools">
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

type PanelTabProps = { id: string; label: string; icon: ReactNode; active?: boolean; children: ReactNode };

// One tab's content, with its title. Hidden (not removed) while another tab is open, so it keeps
// its state.
export function PanelTab({ id, label, active = false, children }: PanelTabProps) {
  return (
    <section id={panelId(id)} role="tabpanel" aria-labelledby={tabId(id)} className="panel" hidden={!active}>
      <h2 className="panel-title">{label}</h2>
      {children}
    </section>
  );
}

const tabId = (id: string) => `panel-tab-${id}`;
const panelId = (id: string) => `panel-${id}`;
