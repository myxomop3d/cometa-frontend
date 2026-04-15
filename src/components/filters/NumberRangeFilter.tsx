import { DebouncedInput } from "@/components/DebouncedInput";

interface NumberRangeFilterProps {
  valueMin: number | undefined;
  valueMax: number | undefined;
  onChangeMin: (value: number | undefined) => void;
  onChangeMax: (value: number | undefined) => void;
  placeholderMin?: string;
  placeholderMax?: string;
  className?: string;
}

export function NumberRangeFilter({
  valueMin,
  valueMax,
  onChangeMin,
  onChangeMax,
  placeholderMin = "Min",
  placeholderMax = "Max",
  className,
}: NumberRangeFilterProps) {
  return (
    <div className={`flex gap-1 ${className ?? ""}`}>
      <DebouncedInput
        type="number"
        placeholder={placeholderMin}
        value={valueMin !== undefined ? String(valueMin) : ""}
        onChange={(v) => onChangeMin(v ? Number(v) : undefined)}
      />
      <DebouncedInput
        type="number"
        placeholder={placeholderMax}
        value={valueMax !== undefined ? String(valueMax) : ""}
        onChange={(v) => onChangeMax(v ? Number(v) : undefined)}
      />
    </div>
  );
}
