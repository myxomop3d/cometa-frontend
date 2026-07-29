import { useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CustomNode } from "./custom-node";
import { DataFlowEdge } from "./data-flow-edge";
import { layoutGraph } from "../layout";
import { isHighlighted } from "../highlight";
import type { Selection, FlowGraphNode, FlowGraphEdge } from "../types";

const nodeTypes = { flowGraphNode: CustomNode };
const edgeTypes = { dataFlow: DataFlowEdge };

interface FlowGraphCanvasProps {
  graph: { nodes: FlowGraphNode[]; edges: FlowGraphEdge[] };
  selection: Selection;
  onSelect: (sel: Selection) => void;
}

function FlowGraphCanvasInner({ graph, selection, onSelect }: FlowGraphCanvasProps) {
  const [nodes, setNodes] = useState<FlowGraphNode[]>(graph.nodes);
  const [edges, setEdges] = useState<FlowGraphEdge[]>(graph.edges);
  const [hoveredCrossGuid, setHoveredCrossGuid] = useState<string | null>(null);
  const [laidOut, setLaidOut] = useState(false);

  const { fitView } = useReactFlow<FlowGraphNode, FlowGraphEdge>();
  // Identity of the graph whose measured layout has already been applied.
  const laidOutGraph = useRef<FlowGraphCanvasProps["graph"] | null>(null);

  // New graph → load its nodes/edges so React Flow measures them from scratch.
  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setLaidOut(false);
  }, [graph]);

  // Once every node of the current graph has been measured (dimensions arrive via
  // onNodesChange → applyNodeChanges), lay out from those real sizes and fit.
  // We read our own `nodes` state, never getNodes(): the React Flow store lags a
  // render behind the controlled `nodes` prop, so reading it right after a graph
  // swap returns the previous node set and would clobber the new one.
  //
  // `laidOut` is the freshness gate: on the render where `graph` changes, the
  // reset effect above has queued `setLaidOut(false)` but this render still sees
  // the previous `true`, so we skip it and only proceed on a later render where
  // `nodes`/`edges` are the new graph's — never the stale pre-swap closure.
  useEffect(() => {
    if (laidOut || laidOutGraph.current === graph) return;
    if (nodes.length !== graph.nodes.length) return; // new nodes not loaded yet
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const allMeasured = graph.nodes.every((gn) => {
      const w = byId.get(gn.id)?.measured?.width;
      return typeof w === "number" && w > 0;
    });
    if (!allMeasured) return; // wait for measurement

    laidOutGraph.current = graph;
    setNodes((ns) => layoutGraph(ns, edges));
    setLaidOut(true);
  }, [laidOut, nodes, graph, edges]);

  // Fallback so the graph can never stay hidden (opacity 0) forever: if
  // measurement never completes for every node — e.g. the canvas mounted while
  // its container was display:none, or React Flow failed to measure a node — lay
  // out after a grace period with whatever sizes we have (unmeasured nodes fall
  // back to the default size in layoutGraph) so it becomes visible and usable.
  useEffect(() => {
    if (laidOut || laidOutGraph.current === graph) return;
    const timer = setTimeout(() => {
      if (laidOutGraph.current === graph) return;
      laidOutGraph.current = graph;
      setNodes((ns) => layoutGraph(ns, edges));
      setLaidOut(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [laidOut, graph, edges]);

  // Fit the view once, when a fresh layout becomes visible. Keyed on `laidOut`
  // (not `nodes`) so the frequent node re-renders don't cancel the pending fit.
  useEffect(() => {
    if (!laidOut) return;
    const raf = requestAnimationFrame(() => fitView({ padding: 0.2 }));
    return () => cancelAnimationFrame(raf);
  }, [laidOut, fitView]);

  const onNodesChange: OnNodesChange<FlowGraphNode> = (changes) =>
    setNodes((ns) => applyNodeChanges(changes, ns));
  const onEdgesChange: OnEdgesChange<FlowGraphEdge> = (changes) =>
    setEdges((es) => applyEdgeChanges(changes, es));

  const onNodeClick: NodeMouseHandler<FlowGraphNode> = (_, node) => {
    onSelect({ kind: "node", id: Number(node.id) });
  };
  const onEdgeClick: EdgeMouseHandler<FlowGraphEdge> = (_, edge) => {
    const merged = edge.data?.merged;
    if (merged) onSelect({ kind: "mergedLink", crossGuid: merged.crossGuid });
    else onSelect({ kind: "link", id: Number(edge.id) });
  };
  const onEdgeMouseEnter: EdgeMouseHandler<FlowGraphEdge> = (_, edge) =>
    setHoveredCrossGuid(edge.data?.crossGuid ?? null);
  const onEdgeMouseLeave: EdgeMouseHandler<FlowGraphEdge> = () =>
    setHoveredCrossGuid(null);
  const onPaneClick = () => onSelect(null);

  return (
    // Hidden until the measured layout is applied, so the pre-layout stack at the
    // origin never flashes on load or on collapse/expand.
    <div
      className="h-full w-full transition-opacity duration-150"
      style={{ opacity: laidOut ? 1 : 0 }}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: selection?.kind === "node" && selection.id === Number(n.id) }))}
        edges={edges.map((e) => ({
          ...e,
          selected:
            (selection?.kind === "link" && selection.id === Number(e.id)) ||
            (selection?.kind === "mergedLink" &&
              selection.crossGuid === e.data?.merged?.crossGuid),
          data: e.data && {
            ...e.data,
            highlighted: isHighlighted(e.data.crossGuid, hoveredCrossGuid),
          },
        }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onPaneClick={onPaneClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}

export function FlowGraphCanvas(props: FlowGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
