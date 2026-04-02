import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataGridAddRowProps {
  onAddRow: () => void;
  disabled?: boolean;
  label?: string;
}

export function DataGridAddRow({
  onAddRow,
  disabled,
  label = "Add row",
}: DataGridAddRowProps) {
  return (
    <div className="flex items-center border-t px-4 py-2">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-muted-foreground"
        onClick={onAddRow}
        disabled={disabled}
      >
        <PlusIcon className="size-4" />
        {label}
      </Button>
    </div>
  );
}
