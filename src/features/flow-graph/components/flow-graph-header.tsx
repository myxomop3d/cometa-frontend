import type { EnvironmentCode, FlowDto } from "@/types/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FlowCombobox } from "./flow-combobox";

const ENVIRONMENTS: EnvironmentCode[] = ["DEV", "IFT", "UAT", "PROD"];

interface FlowGraphHeaderProps {
  flow?: FlowDto;
  flowId?: number;
  env: EnvironmentCode;
  onFlowChange: (id: number) => void;
  onEnvChange: (env: EnvironmentCode) => void;
  hasPairs?: boolean;
  allCollapsed?: boolean;
  allExpanded?: boolean;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
}

export function FlowGraphHeader({
  flow,
  flowId,
  env,
  onFlowChange,
  onEnvChange,
  hasPairs,
  allCollapsed,
  allExpanded,
  onCollapseAll,
  onExpandAll,
}: FlowGraphHeaderProps) {
  return (
    <div className="flex h-full items-center justify-between gap-4 border-b px-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        {flow ? (
          <>
            <h1 className="truncate text-lg font-semibold">{flow.caption}</h1>
            <Meta label="Key" value={flow.key} />
            <Meta label="Integrity" value={flow.integrity ?? "—"} />
            <Meta label="Confidentiality" value={flow.confidentiality ?? "—"} />
            <Meta label="Secret class" value={flow.secretClass ?? "—"} />
            <Meta label="Data class" value={flow.dataClass} />
            <Meta label="Data type" value={flow.dataType} />
          </>
        ) : (
          <h1 className="truncate text-lg font-semibold text-muted-foreground">
            {flowId !== undefined ? `Flow #${flowId} not found` : "No flow selected"}
          </h1>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hasPairs && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={allCollapsed ? "default" : "outline"}
              onClick={onCollapseAll}
            >
              Collapse proxies
            </Button>
            <Button
              size="sm"
              variant={allExpanded ? "default" : "outline"}
              onClick={onExpandAll}
            >
              Expand proxies
            </Button>
          </div>
        )}
        <Select value={env} onValueChange={(v) => onEnvChange(v as EnvironmentCode)}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENVIRONMENTS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FlowCombobox value={flowId} onChange={onFlowChange} />
      </div>
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
