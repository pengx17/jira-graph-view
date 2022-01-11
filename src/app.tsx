import * as React from "react";
import { BG } from "./bg";
import { ControlPanel } from "./control-panel";
import { JiraGraph } from "./jira-graph";

export function App() {
  return (
    <div>
      <ControlPanel />
      <JiraGraph />
      <BG />
    </div>
  );
}
