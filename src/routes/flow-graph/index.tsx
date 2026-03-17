import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/flow-graph/")({
  component: FlowGraphPage,
});

function FlowGraphPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Flow Graph</h1>
      <p className="mt-2 text-muted-foreground">Hello, World!</p>
    </div>
  );
}
