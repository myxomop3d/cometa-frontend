import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface DebouncedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
}

export function DebouncedInput({
  value: externalValue,
  onChange,
  debounce = 300,
  ...props
}: DebouncedInputProps) {
  const [value, setValue] = useState(externalValue);

  useEffect(() => {
    setValue(externalValue);
  }, [externalValue]);

  useEffect(() => {
    const id = setTimeout(() => onChange(value), debounce);
    return () => clearTimeout(id);
  }, [value, debounce]);

  return <Input {...props} value={value} onChange={(e) => setValue(e.target.value)} />;
}
