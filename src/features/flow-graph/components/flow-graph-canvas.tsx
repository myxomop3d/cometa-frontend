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

export function FlowGraphCanvas({ graph, selection, onSelect }: FlowGraphCanvasProps) {
  const laidOut = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);
  const [nodes, setNodes] = useState<FlowGraphNode[]>(laidOut);
  const [edges, setEdges] = useState<FlowGraphEdge[]>(graph.edges);
  const [hoveredCrossGuid, setHoveredCrossGuid] = useState<string | null>(null);

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
  const onEdgeMouseEnter: EdgeMouseHandler<FlowGraphEdge> = (_, edge) =>
    setHoveredCrossGuid(edge.data?.crossGuid ?? null);
  const onEdgeMouseLeave: EdgeMouseHandler<FlowGraphEdge> = () =>
    setHoveredCrossGuid(null);
  const onPaneClick = () => onSelect(null);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: selection?.kind === "node" && selection.id === Number(n.id) }))}
        edges={edges.map((e) => ({
          ...e,
          selected: selection?.kind === "link" && selection.id === Number(e.id),
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
