import { findShortestPath } from "@antv/algorithm";
import { IEdge, INode, NodeConfig } from "@antv/g6";
import Graphin, {
  Behaviors,
  GraphinContext,
  GraphinData,
  IG6GraphEvent,
} from "@antv/graphin";
import { Tooltip } from "@antv/graphin-components";
import "@antv/graphin-icons/dist/index.css";
import { useAtom } from "jotai";
import React from "react";
import { peerAtom, seedAtom } from "./atoms";
import { useFetchGraphinData, useGraphinData } from "./graphin-data";
import { Spinner } from "./spinner";
import { useDebouncedCallback } from "./utils/use-debounced";

const CustomBehavior = ({ data }: { data: GraphinData }) => {
  const [seed, seeSeed] = useAtom(seedAtom);
  const [peer, setPeer] = useAtom(peerAtom);
  const { graph, apis } = React.useContext(GraphinContext);
  const graphRef = React.useRef(graph);
  const apisRef = React.useRef(apis);
  const seedRef = React.useRef(seed);

  React.useEffect(() => {
    setTimeout(() => {
      // graphRef.current.render();
    }, 100);
  }, []);

  const debouncedReorderEdges = useDebouncedCallback(() => {
    graphRef.current
      .findAll<IEdge>("edge", (edge) => {
        const model = edge.getModel();
        return (
          model.source === seedRef.current || model.target === seedRef.current
        );
      })
      .forEach((edge) => {
        edge.toFront();
        edge.getSource().toFront();
        edge.getTarget().toFront();
      });
  }, 100);

  const debouncedFocus = useDebouncedCallback((seed) => {
    apisRef.current.focusNodeById(seed);
    debouncedReorderEdges();
  }, 100);

  graphRef.current = graph;
  apisRef.current = apis;
  seedRef.current = seed;

  React.useEffect(() => {
    debouncedReorderEdges();
  }, [data, debouncedReorderEdges]);

  React.useEffect(() => {
    const node = graphRef.current.findById(seed);
    if (node) {
      debouncedFocus(seed);
      debouncedReorderEdges();
    }
  }, [seed, data, debouncedFocus, debouncedReorderEdges]);

  const clearStates = React.useCallback(() => {
    const allNodes = graph.getNodes();
    allNodes.forEach((node) => {
      graph.clearItemStates(node);
    });
    graph.getEdges().forEach((edge) => {
      graph.clearItemStates(edge);
    });
    const seedNode = graph.findById(seed);
    if (seedNode) {
      graph.setItemState(seedNode, "selected", true);
    }
  }, [graph, seed]);

  React.useEffect(() => {
    clearStates();
    if (!peer || !seed || !data) {
      return;
    }
    const { path } = findShortestPath(data, seed, peer);
    if (!path) {
      console.log("no path from " + peer + " to " + seed);
      return;
    }
    const pathNodeMap = {};
    path.forEach((id) => {
      const pathNode = graph.findById(id);
      pathNode.toFront();
      graph.setItemState(pathNode, "highlight", true);
      pathNodeMap[id] = true;
    });
    graph.getEdges().forEach((edge) => {
      const edgeModel = edge.getModel();
      const source = edgeModel.source;
      const target = edgeModel.target;
      const sourceInPathIdx = path.indexOf(source);
      const targetInPathIdx = path.indexOf(target);

      if (
        sourceInPathIdx >= 0 &&
        targetInPathIdx >= 0 &&
        Math.abs(sourceInPathIdx - targetInPathIdx) === 1
      ) {
        graph.setItemState(edge, "highlight", true);
      } else {
        graph.setItemState(edge, "inactive", true);
      }
    });
    graph.getNodes().forEach((node) => {
      if (!pathNodeMap[node.getID()]) {
        graph.setItemState(node, "inactive", true);
      }
    });
  }, [clearStates, data, graph, peer, seed]);

  React.useEffect(() => {
    // Change Focus:
    const handleDBclick = (evt: IG6GraphEvent) => {
      const node = evt.item as INode;
      const model = node.getModel() as NodeConfig;
      seeSeed(model.id);
      setPeer(null);
    };

    // Change path to (find the shortest path)
    const handleClick = async (evt: IG6GraphEvent) => {
      const from = seed;
      const to = evt.item.getModel().id;
      if (from === to || to === peer) {
        return;
      }
      setPeer(to);
    };

    const handleCanvasClick = () => {
      setPeer(null);
    };

    graph.on("node:dblclick", handleDBclick);
    graph.on("node:click", handleClick);
    graph.on("canvas:click", handleCanvasClick);
    return () => {
      graph.off("node:dblclick", handleDBclick);
      graph.off("node:click", handleClick);
      graph.off("canvas:click", handleCanvasClick);
    };
  }, [seed, seeSeed, graph, data, clearStates, setPeer, peer]);
  return null;
};

const nodeStateStyles = {
  status: {
    inactive: {
      icon: {
        visible: false,
      },
    },
  },
};

const edgeStateStyles = {
  status: {
    inactive: {
      keyshape: {
        visible: false,
      },
    },
    highlight: {
      keyshape: {
        visible: true,
        stroke: "#1890ff",
      },
      halo: {
        fill: "#1890ff",
        fillOpacity: 0.05,
        visible: true,
      },
    },
  },
};

function filterDataBySeed(data: GraphinData, seed: string) {
  if (data && data.edges && data.nodes) {
    const edges = data.edges.filter(
      (edge) => edge.source === seed || edge.target === seed
    );
    const nodes = data.nodes.filter((node) =>
      edges.some((e) => e.source === node.id || e.target === node.id)
    );

    return { edges, nodes };
  }
}

function usePrevious<T>(state: T) {
  const ref = React.useRef<T>();

  React.useEffect(() => {
    // @ts-ignore
    if (state && state.nodes.length) {
      ref.current = state;
    }
  }, [state]);

  return ref;
}

const useSpringData = () => {
  const [seed] = useAtom(seedAtom);
  const [data] = useGraphinData();
  const [localData, setLocalData] = React.useState(data);
  const prevData = usePrevious(data);

  React.useEffect(() => {
    let canceled = false;
    const timers = [];
    setLocalData(() => {
      return { nodes: [], edges: [] };
    });

    setTimeout(() => {
      if (!canceled) {
        setLocalData(() => {
          // Hack node size
          const rootNode = prevData.current?.nodes?.find((n) => n.id === seed);
          if (rootNode) {
            rootNode.style.keyshape.size = 64;
            rootNode.style.icon.size = 64;
            rootNode.style.icon.clip = { r: 32 };
          }
          return { nodes: rootNode ? [rootNode] : [], edges: [] };
        });
      }
    });

    return () => {
      canceled = true;
      timers.forEach(clearTimeout);
    };
  }, [prevData, seed]);

  React.useEffect(() => {
    if (!data) {
      return;
    }
    let canceled = false;
    const timers = [];
    timers.push(
      setTimeout(() => {
        if (!canceled) {
          setLocalData(filterDataBySeed(data, seed));
        }
      }, 100)
    );
    if (data) {
      timers.push(
        setTimeout(() => {
          if (!canceled) {
            setLocalData(data);
          }
        }, 2000)
      );
    }

    return () => {
      canceled = true;
      timers.forEach(clearTimeout);
    };
  }, [data, seed]);

  return localData;
};

const defSpringLen = (_edge, source, target) => {
  // /** 默认返回的是 200 的弹簧长度 */
  // /** 如果你要想要产生聚类的效果，可以考虑 根据边两边节点的度数来动态设置边的初始化长度：度数越小，则边越短 */
  // const nodeSize = 32;
  // const Sdegree = source.data.layout.degree;
  // const Tdegree = target.data.layout.degree;
  // const degree = Math.max(Math.min(Sdegree, Tdegree), 3);
  // return degree * nodeSize;
  return 200;
};

export function JiraGraph() {
  const { loading } = useFetchGraphinData();
  const data = useSpringData();
  const [seed] = useAtom(seedAtom);
  // const comboOptions = React.useMemo(() => {
  //   const groups = lodash.groupBy(data?.nodes ?? [], (n) => n.Office);
  //   return Object.entries(groups).map(([office, items]) => {
  //     return {
  //       members: items.map((n) => n.id),
  //       id: office === 'undefined' ? 'null' : office,
  //     };
  //   });
  // }, [data]);
  return (
    <div>
      <Spinner
        style={{
          transition: "all 0.2s",
          position: "fixed",
          top: "10px",
          right: "10px",
          zIndex: 10,
          opacity: loading ? 1 : 0,
        }}
      />

      {data && data.nodes.length > 0 && (
        <Graphin
          key={seed}
          modes={{ default: [] }}
          data={data}
          style={{ height: "100vh" }}
          theme={{ background: "transparent", primaryColor: "#440099" }}
          nodeStateStyles={nodeStateStyles}
          edgeStateStyles={edgeStateStyles}
          animate={false}
          layout={{
            type: "graphin-force",
            preventOverlap: true,
            animation: true,
            defSpringLen,
          }}
        >
          <Tooltip
            bindType="edge"
            placement="top"
            style={{ width: "fit-content" }}
          >
            <Tooltip.Edge>
              {(model) => {
                return (
                  <div style={{ whiteSpace: "nowrap" }}>
                    {model.edges.map((edge) => {
                      const info = edge.ticket;
                      return (
                        <div
                          key={info[":issue/key"]}
                          style={{ fontSize: "12px" }}
                        >
                          {info[":issue/key"]}: {info[":issue/summary"]}
                          <br />
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            </Tooltip.Edge>
          </Tooltip>
          <Behaviors.DragCanvas />
          <Behaviors.DragNode />
          <Behaviors.ZoomCanvas />
          <CustomBehavior data={data} />
        </Graphin>
      )}
    </div>
  );
}
