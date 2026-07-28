import { useEffect, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { EnvironmentCode } from "@/types/api";
import { flowApi } from "@/features/flow/api";
import { flowGraphQueryOptions } from "../api";
import { buildGraph } from "../build-graph";
import { analyzePairs } from "../pairs";
import { collapseGraph } from "../collapse";
import { assignParallelOffsets } from "../parallel";
import { collapseAll, expandAll, showNode, hideNode } from "../expand-state";
import type { Selection } from "../types";
import { FlowGraphHeader } from "./flow-graph-header";
import { FlowGraphCanvas } from "./flow-graph-canvas";
import { DetailsPanel } from "./details-panel";

interface FlowGraphPageProps {
  flowId?: number;
  env: EnvironmentCode;
  onFlowChange: (id: number) => void;
  onEnvChange: (env: EnvironmentCode) => void;
}

export function FlowGraphPage({ flowId, env, onFlowChange, onEnvChange }: FlowGraphPageProps) {
  if (flowId === undefined) {
    return (
      <PageLayout
        header={
          <FlowGraphHeader env={env} onFlowChange={onFlowChange} onEnvChange={onEnvChange} />
        }
      >
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select a flow to view its graph.
        </div>
      </PageLayout>
    );
  }
  return (
    <LoadedFlowGraphPage
      flowId={flowId}
      env={env}
      onFlowChange={onFlowChange}
      onEnvChange={onEnvChange}
    />
  );
}

function LoadedFlowGraphPage({
  flowId,
  env,
  onFlowChange,
  onEnvChange,
}: FlowGraphPageProps & { flowId: number }) {
  const { data } = useSuspenseQuery(flowGraphQueryOptions(flowId, env));
  const { data: flowRes } = useSuspenseQuery(flowApi.detailQueryOptions(flowId));
  const flow = flowRes.data;
  const graph = useMemo(() => buildGraph(data.data), [data]);
  const pairIndex = useMemo(() => analyzePairs(graph), [graph]);
  const [selection, setSelection] = useState<Selection>(null);
  const [expandedGuids, setExpandedGuids] = useState<Set<string>>(new Set());
  const collapsed = useMemo(() => {
    const c = collapseGraph(graph, pairIndex, expandedGuids);
    return { nodes: c.nodes, edges: assignParallelOffsets(c.edges) };
  }, [graph, pairIndex, expandedGuids]);

  useEffect(() => {
    setSelection(null);
    setExpandedGuids(new Set());
  }, [flowId, env]);

  const hasPairs = pairIndex.pairs.size > 0;
  const allCollapsed = expandedGuids.size === 0;
  const allExpanded = hasPairs && expandedGuids.size === pairIndex.pairs.size;

  return (
    <PageLayout
      header={
        <FlowGraphHeader
          flow={flow}
          flowId={flowId}
          env={env}
          onFlowChange={onFlowChange}
          onEnvChange={onEnvChange}
          hasPairs={hasPairs}
          allCollapsed={allCollapsed}
          allExpanded={allExpanded}
          onCollapseAll={() => setExpandedGuids(collapseAll())}
          onExpandAll={() => setExpandedGuids(expandAll(pairIndex))}
        />
      }
    >
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="70%" minSize="30%">
          <FlowGraphCanvas graph={collapsed} selection={selection} onSelect={setSelection} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="30%" minSize="15%">
          <div className="h-full overflow-y-auto">
            <DetailsPanel
              selection={selection}
              graph={graph}
              pairIndex={pairIndex}
              onShowNode={(guid) => {
                setExpandedGuids((s) => showNode(s, guid));
                const proxyNodeId = pairIndex.pairs.get(guid)?.proxyNodeId;
                if (proxyNodeId !== undefined) {
                  setSelection({ kind: "node", id: proxyNodeId });
                }
              }}
              onHideNode={(nodeId) => {
                setExpandedGuids((s) => hideNode(s, pairIndex, nodeId));
                setSelection(null);
              }}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </PageLayout>
  );
}

function PageLayout({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-3rem)] w-full">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize="12%" minSize="8%" maxSize="25%">
          {header}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="88%" minSize="60%">
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
