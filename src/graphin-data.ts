import { Utils } from "@antv/graphin";
import "@antv/graphin-icons/dist/index.css";
import { useAtom } from "jotai";
import React from "react";
import { graphDataAtomFamily, seedAtom } from "./atoms";

const sessionId = (() => {
  const sessionKey = "hack-217-session-id";
  const id = sessionStorage.getItem(sessionKey) ?? new Date().getTime();
  sessionStorage.setItem(sessionKey, `${id}`);
  return id;
})();

export const useGraphinData = () => {
  const [seed] = useAtom(seedAtom);
  const dataAtom = graphDataAtomFamily(seed);

  return useAtom(dataAtom);
};

// This should be called only once across the app
export const useFetchGraphinData = () => {
  const [loading, setLoading] = React.useState(false);
  const [seed] = useAtom(seedAtom);
  const [data, setData] = useGraphinData();
  React.useEffect(() => {
    if (!seed) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null); // reset data
    fetch(`/api/graphin-data?focus=${seed}`, {
      headers: {
        "x-session-id": "" + sessionId,
      },
    }).then(async (data) => {
      if (cancelled) {
        return;
      }
      const { edges, nodes } = await data.json();

      setData({
        edges: Utils.processEdges(edges, { poly: 40, loop: 0 }),
        nodes,
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [seed, setData]);
  return { data, loading };
};
