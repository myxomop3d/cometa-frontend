import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { CustomHandle } from "./custom-handle";
import type { FlowGraphNode } from "../types";

const NODE_TONE: Record<string, string> = {
  microservice: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
  topic: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
  egress: "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30",
};

function FlowGraphNodeView({ data, selected }: NodeProps<FlowGraphNode>) {
  const { node, handles } = data;
  const tone = NODE_TONE[node.dtoType] ?? "border-slate-400 bg-slate-50 dark:bg-slate-900/30";

  const leftHandles = handles.filter((h) => h.side === "left");
  const rightHandles = handles.filter((h) => h.side === "right");

  const spread = (count: number, index: number) =>
    count === 0 ? 50 : ((index + 1) / (count + 1)) * 100;

  return (
    <div
      className={cn(
        "min-w-[220px] rounded-md border-2 shadow-sm",
        tone,
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="border-b px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{node.dtoType}</div>
        <div className="text-sm font-semibold">{node.name}</div>
      </div>
      {/* <ul className="px-3 py-2 text-xs">
        {handles.map((h) => (
          <li key={h.interfaceId} className="flex justify-between gap-2 py-0.5">
            <span className="truncate">{h.label}</span>
            <span className="text-muted-foreground">{h.dtoType}</span>
          </li>
        ))}
      </ul> */}

      {leftHandles.map((h, i) => (
        <CustomHandle key={h.interfaceId} descriptor={h} topPercent={spread(leftHandles.length, i)} />
      ))}
      {rightHandles.map((h, i) => (
        <CustomHandle key={h.interfaceId} descriptor={h} topPercent={spread(rightHandles.length, i)} />
      ))}
    </div>
  );
}

export const CustomNode = memo(FlowGraphNodeView);
