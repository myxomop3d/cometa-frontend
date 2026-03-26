import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectFilterProps {
  options: { label: string; value: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function SelectFilter({
  options,
  value,
  onChange,
  placeholder,
  className,
}: SelectFilterProps) {
  return (
    <div className={className}>
      <Select
        value={value ?? "__all__"}
        onValueChange={(v) => onChange(v === "__all__" ? undefined : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
