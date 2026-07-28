import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowGraphEdge } from "../types";

const LABEL_LIFT = 14;

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
  // Shift both endpoints along the perpendicular of the source->target vector so
  // parallel links between the same pair fan into distinct lanes. getBezierPath
  // regenerates horizontal-tangent control points from the shifted endpoints, so
  // the whole curve (and its arrowheads) rides the lane. Offset 0 == unchanged.
  const laneOffset = data?.laneOffset ?? 0;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy);
  const ox = len === 0 ? 0 : (-dy / len) * laneOffset;
  const oy = len === 0 ? 0 : (dx / len) * laneOffset;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX + ox,
    sourceY: sourceY + oy,
    targetX: targetX + ox,
    targetY: targetY + oy,
    sourcePosition,
    targetPosition,
  });

  const roundTrip = data?.roundTrip ?? false;
  const highlighted = data?.highlighted ?? false;
  const strokeWidth = highlighted ? 3 : selected ? 2.5 : 1.5;
  const merged = data?.merged != null;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          strokeWidth,
          ...(merged ? { strokeDasharray: "6 4" } : {}),
          ...(highlighted ? { stroke: "#f59e0b" } : {}),
        }}
      />
      {/* Running circle animates source → target = the data-flow direction.
          Bidirectional links do a 0→1→0 round trip (request out, response back). */}
      <circle
        r={highlighted ? 5 : 4}
        className="fill-primary"
        style={highlighted ? { fill: "#f59e0b" } : undefined}
      >
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
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - LABEL_LIFT}px)`,
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
