import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { flowGraphQueryOptions } from "../api";
import { buildGraph } from "../build-graph";
import type { Selection } from "../types";
import { FlowGraphHeader } from "./flow-graph-header";
import { FlowGraphCanvas } from "./flow-graph-canvas";
import { DetailsPanel } from "./details-panel";

interface FlowGraphPageProps {
  flowId: number;
  onFlowChange: (id: number) => void;
}

export function FlowGraphPage({ flowId, onFlowChange }: FlowGraphPageProps) {
  const { data } = useSuspenseQuery(flowGraphQueryOptions(flowId));
  const graph = useMemo(() => buildGraph(data.data), [data]);
  const [selection, setSelection] = useState<Selection>(null);

  return (
    <div className="h-[calc(100vh-3rem)] w-full">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={12} minSize={8} maxSize={25}>
          <FlowGraphHeader flow={data.data.flow} flowId={flowId} onFlowChange={onFlowChange} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={88} minSize={60}>
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={70} minSize={30}>
              <FlowGraphCanvas graph={graph} selection={selection} onSelect={setSelection} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="h-full overflow-y-auto">
                <DetailsPanel selection={selection} graph={graph} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
