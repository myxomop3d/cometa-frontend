import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdvancedFilterToggle({
  advanced,
  onToggle,
}: {
  advanced: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={advanced}
      className={cn(advanced && "border-primary text-primary")}
      onClick={onToggle}
    >
      <SlidersHorizontal className="mr-1 size-4" />
      Advanced filters
    </Button>
  );
}
