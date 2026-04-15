import type { FlowDto } from "@/types/api";
import { FlowCombobox } from "./flow-combobox";

interface FlowGraphHeaderProps {
  flow: FlowDto;
  flowId: number;
  onFlowChange: (id: number) => void;
}

export function FlowGraphHeader({ flow, flowId, onFlowChange }: FlowGraphHeaderProps) {
  return (
    <div className="flex h-full items-center justify-between gap-4 border-b px-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="truncate text-lg font-semibold">{flow.caption}</h1>
        <Meta label="Code" value={flow.code} />
        <Meta label="Integrity" value={flow.integrity ?? "—"} />
        <Meta label="Confidentiality" value={flow.confidentiality ?? "—"} />
        <Meta label="Data class" value={flow.dataClass} />
        <Meta label="Data type" value={flow.dataType} />
        <Meta label="State" value={flow.state} />
      </div>
      <FlowCombobox value={flowId} onChange={onFlowChange} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{label}:</span> {value}
    </span>
  );
}
