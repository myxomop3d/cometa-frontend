import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowGraphEdge } from "../types";

function DataFlowEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  selected,
  label,
  data,
}: EdgeProps<FlowGraphEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const roundTrip = data?.roundTrip ?? false;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{ strokeWidth: selected ? 2.5 : 1.5 }}
      />
      {/* Running circle animates source → target = the data-flow direction.
          Bidirectional links do a 0→1→0 round trip (request out, response back). */}
      <circle r={4} className="fill-primary">
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={edgePath}
          {...(roundTrip
            ? { keyPoints: "0;1;0", keyTimes: "0;0.5;1", calcMode: "linear" as const }
            : {})}
        />
      </circle>
      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-background/80 px-1 text-[10px] text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DataFlowEdge = memo(DataFlowEdgeView);
