import "@antv/graphin-icons/dist/index.css";
import { useAtom } from "jotai";
import React, { useState } from "react";
import classnames from "classnames";
import { graphDataAtomFamily, peerAtom, seedAtom } from "./atoms";
import styles from "./control-panel.module.css";
import "./font.css";

const allUsers = new Set();
const wonderedUsers = new Set();

const UsagePanel = () => {
  const [showInstruction, setShowInstruction] = useState(true);
  return (
    <div className={styles.infoPanel}>
      {showInstruction && (
        <div className={styles.instruction}>
          <div className={styles.instructionTitle}>Usage</div>
          <ul style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            <li>Click icon to show the path</li>
            <li>Double click icon to change focus</li>
            <li>Hover the links to see the related tickets</li>
          </ul>
          <div
            className={styles.instrctionToggle}
            onClick={() => setShowInstruction(false)}
          >
            <span className="material-icons-round">close</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const ControlPanel = () => {
  const [seed, setSeed] = useAtom(seedAtom);
  const [peer] = useAtom(peerAtom);
  const dataAtom = graphDataAtomFamily(seed);
  const [data] = useAtom(dataAtom);
  const [internalSeed, setInternalSeed] = React.useState<string | null>(seed);

  const noData = !data || !data.nodes || data.nodes.length === 0;

  const seedUser = React.useMemo(() => {
    return data?.nodes.find((node) => node.id === seed);
  }, [seed, data]);

  React.useEffect(() => {
    setInternalSeed(seed);
  }, [seed]);

  React.useEffect(() => {
    // @ts-ignore
    if (window.__wonder__) {
      setTimeout(() => {
        data.nodes.forEach((node) => {
          allUsers.add(node.id);
        });
        const u = Array.from(allUsers).find((u) => {
          return !wonderedUsers.has(u);
        }) as string;
        if (u) {
          wonderedUsers.add(u);
          setSeed(u);
        } else {
          wonderedUsers.clear();
        }
      }, 5000);
    }
  }, [data, setSeed]);

  return (
    <div className={classnames(styles.root, !seed && styles.noSeed)}>
      <div style={{ fontWeight: 300, fontSize: "2rem" }}>
        <span
          style={{
            color: "rgba(200,200,200, 1)",
            fontSize: "2rem",
            position: "absolute",
            top: "12px",
            left: "8px",
          }}
          className="material-icons-round"
        >
          search
        </span>{" "}
        <input
          className={styles.usernameInput}
          value={internalSeed}
          onChange={(e) => setInternalSeed(e.target.value)}
          onBlur={(e) => setSeed(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              // @ts-ignore
              e.target.blur();
            }
          }}
        />
        {peer ? ` -  ${peer}` : ""}
      </div>
      <div className={styles.info}>
        {seedUser && (
          <div className={styles.infoDetail}>
            <div className={styles.avatar}>
              <img src={seedUser["avatar"]} />
            </div>
            <div className={styles.contact}>
              <div className={styles.name}>{seedUser[":user/displayName"]}</div>
              <div className={styles.contactItem}>
                <span className={`material-icons-round ${styles.placeIcon}`}>
                  place
                </span>
                <span>{seedUser["Department"]} </span>
                <span>{seedUser["Office"]}</span>
              </div>
              <div className={styles.contactItem}>
                <span className={`material-icons-round ${styles.placeIcon}`}>
                  mail
                </span>
                <span>{seedUser["Mobile Number"]}</span>
              </div>
            </div>
          </div>
        )}
        <div className={styles.hint}>
          {!seed && "To get started, please enter a LDAP username"}
          {data && noData && seed && `No data for username ${seed}`}
        </div>
        {!noData && <UsagePanel />}

        <div style={{ flex: 1 }} />
        <div>
          <div className={styles.legendTitle}>Legend</div>
          <ul className={styles.legendContent}>
            <li>
              <span style={{ color: "red" }} className="material-icons-round">
                arrow_right_alt
              </span>{" "}
              Cross office collaboration
            </li>
            <li>
              <span
                style={{ color: "rgba(100,100,100, 0.9)" }}
                className="material-icons-round"
              >
                arrow_right_alt
              </span>{" "}
              Primary links
            </li>
            <li>
              <span
                style={{ color: "rgba(220, 220, 220)" }}
                className="material-icons-round"
              >
                arrow_right_alt
              </span>{" "}
              Secondary links
            </li>
          </ul>
          <ul className={styles.legendContent}>
            <li>
              <div className={styles.barWrapper}>
                <span className={styles.bar}></span>
              </div>{" "}
              Bar thickness indicates the number of connected tickets
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
