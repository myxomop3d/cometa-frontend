import { Handle, Position, type HandleType } from "@xyflow/react";
import type { HandleDescriptor } from "../types";

const DTO_COLORS: Record<string, string> = {
  restClient: "#3b82f6",
  restServer: "#10b981",
  kafkaClient: "#f59e0b",
};

interface CustomHandleProps {
  descriptor: HandleDescriptor;
  topPercent: number;
}

export function CustomHandle({ descriptor, topPercent }: CustomHandleProps) {
  const isRight = descriptor.side === "right";
  const position = isRight ? Position.Right : Position.Left;
  const type: HandleType = isRight ? "source" : "target";
  const color = DTO_COLORS[descriptor.dtoType] ?? "#6b7280";

  return (
    <Handle
      id={String(descriptor.interfaceId)}
      type={type}
      position={position}
      style={{
        top: `${topPercent}%`,
        background: color,
        width: 10,
        height: 10,
        border: "2px solid white",
      }}
    />
  );
}
