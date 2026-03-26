import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CheckboxFilterProps {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  className?: string;
}

export function CheckboxFilter({
  label,
  value,
  onChange,
  className,
}: CheckboxFilterProps) {
  const stringValue = value === undefined ? "all" : value ? "true" : "false";

  return (
    <div className={className}>
      <Select
        value={stringValue}
        onValueChange={(v) => {
          if (v === "all") onChange(undefined);
          else onChange(v === "true");
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{label}: All</SelectItem>
          <SelectItem value="true">{label}: Yes</SelectItem>
          <SelectItem value="false">{label}: No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
