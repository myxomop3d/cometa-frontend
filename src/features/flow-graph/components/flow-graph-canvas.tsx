import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect } from "react";
import { CustomNode } from "./custom-node";
import { layoutGraph } from "../layout";
import type { BuiltGraph, Selection, FlowGraphNode, FlowGraphEdge } from "../types";

const nodeTypes = { flowGraphNode: CustomNode };

interface FlowGraphCanvasProps {
  graph: BuiltGraph;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}

export function FlowGraphCanvas({ graph, selection, onSelect }: FlowGraphCanvasProps) {
  const laidOut = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);
  const [nodes, setNodes] = useState<FlowGraphNode[]>(laidOut);
  const [edges, setEdges] = useState<FlowGraphEdge[]>(graph.edges);

  useEffect(() => {
    setNodes(laidOut);
    setEdges(graph.edges);
  }, [laidOut, graph.edges]);

  const onNodesChange: OnNodesChange<FlowGraphNode> = (changes) =>
    setNodes((ns) => applyNodeChanges(changes, ns));
  const onEdgesChange: OnEdgesChange<FlowGraphEdge> = (changes) =>
    setEdges((es) => applyEdgeChanges(changes, es));

  const onNodeClick: NodeMouseHandler<FlowGraphNode> = (_, node) => {
    onSelect({ kind: "node", id: Number(node.id) });
  };
  const onEdgeClick: EdgeMouseHandler<FlowGraphEdge> = (_, edge) => {
    onSelect({ kind: "link", id: Number(edge.id) });
  };
  const onPaneClick = () => onSelect(null);

  const handleInterfaceClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const handleEl = target.closest<HTMLElement>(".react-flow__handle");
    if (!handleEl) return;
    const id = handleEl.dataset.handleid;
    if (!id) return;
    event.stopPropagation();
    onSelect({ kind: "interface", id: Number(id) });
  };

  return (
    <div className="h-full w-full" onClickCapture={handleInterfaceClick}>
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: selection?.kind === "node" && selection.id === Number(n.id) }))}
        edges={edges.map((e) => ({ ...e, selected: selection?.kind === "link" && selection.id === Number(e.id) }))}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
