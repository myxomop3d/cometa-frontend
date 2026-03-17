import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/components/")({
  component: ComponentsPage,
});

function ComponentsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Components</h1>
      <p className="mt-2 text-muted-foreground">Hello, World!</p>
    </div>
  );
}
