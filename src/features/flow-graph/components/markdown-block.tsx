interface MarkdownBlockProps {
  value: string | null | undefined;
}

export function MarkdownBlock({ value }: MarkdownBlockProps) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted px-3 py-2 text-xs font-mono">
      {value}
    </pre>
  );
}
