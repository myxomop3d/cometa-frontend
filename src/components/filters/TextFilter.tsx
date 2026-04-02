import { DebouncedInput } from "@/components/DebouncedInput";

interface TextFilterProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function TextFilter({
  value,
  onChange,
  placeholder,
  className,
}: TextFilterProps) {
  return (
    <div className={className}>
      <DebouncedInput
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(v) => onChange(v || undefined)}
      />
    </div>
  );
}
