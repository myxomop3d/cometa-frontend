interface FilterBarProps {
  children: React.ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return <div className="grid grid-cols-4 gap-2 my-4">{children}</div>;
}
