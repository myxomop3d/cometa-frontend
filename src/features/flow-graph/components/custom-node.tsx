import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { FlowGraphNode } from "../types";

const NODE_TONE: Record<string, string> = {
  MICROSERVICE: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
  TOPIC: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
  EGRESS: "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30",
  INGRESS: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
};

function FlowGraphNodeView({ data, selected }: NodeProps<FlowGraphNode>) {
  const { node } = data;
  const tone = NODE_TONE[node.nodeType] ?? "border-slate-400 bg-slate-50 dark:bg-slate-900/30";

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-md border-2 shadow-sm",
        tone,
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{node.nodeType}</div>
        <div className="text-sm font-semibold">{node.name}</div>
        {node.automatedSystem && (
          <div className="truncate text-xs text-muted-foreground">{node.automatedSystem.name}</div>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const CustomNode = memo(FlowGraphNodeView);
