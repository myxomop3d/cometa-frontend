import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/automated-system/")({
  component: AutomatedSystemPage,
});

function AutomatedSystemPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Automated Systems</h1>
      <p className="mt-2 text-muted-foreground">Hello, World!</p>
    </div>
  );
}
