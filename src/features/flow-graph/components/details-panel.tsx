import { ChevronsUpDown } from "lucide-react";
import { stringify } from "yaml";
import type { NodeDto, LinkDto } from "@/types/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldRow } from "./field-row";
import type { Selection, BuiltGraph } from "../types";

interface DetailsPanelProps {
  selection: Selection;
  graph: BuiltGraph;
}

export function DetailsPanel({ selection, graph }: DetailsPanelProps) {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node or link to see its details.
      </div>
    );
  }

  if (selection.kind === "node") {
    const node = graph.nodeById.get(selection.id);
    if (!node) return <Missing />;
    return <NodeDetails node={node} />;
  }
  const link = graph.linkById.get(selection.id);
  if (!link) return <Missing />;
  return <LinkDetails link={link} graph={graph} />;
}

function Missing() {
  return <div className="p-4 text-sm text-muted-foreground">Selected item not found.</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

function NodeDetails({ node }: { node: NodeDto }) {
  return (
    <div>
      <Section title={`${node.nodeType} node`}>
        <FieldRow label="ID">{node.id}</FieldRow>
        <FieldRow label="Name">{node.name}</FieldRow>
        <FieldRow label="Type">{node.nodeType}</FieldRow>
        <FieldRow label="Environment">{node.environment}</FieldRow>
        <FieldRow label="Inserted at">{node.insertedAt ?? "—"}</FieldRow>
        <FieldRow label="Updated at">{node.updatedAt ?? "—"}</FieldRow>
      </Section>
      {node.automatedSystem && (
        <Section title="Automated system">
          <FieldRow label="Name">{node.automatedSystem.name}</FieldRow>
          <FieldRow label="Object code">{node.automatedSystem.objectCode ?? "—"}</FieldRow>
          <FieldRow label="CI">{node.automatedSystem.ci}</FieldRow>
          <FieldRow label="Block">{node.automatedSystem.block}</FieldRow>
          <FieldRow label="Tribe">{node.automatedSystem.tribe}</FieldRow>
          <FieldRow label="Cluster">{node.automatedSystem.cluster}</FieldRow>
          <FieldRow label="Leader">{node.automatedSystem.leader}</FieldRow>
        </Section>
      )}
      <DataSection data={node.data} />
    </div>
  );
}

function DataSection({ data }: { data: unknown }) {
  if (data == null || (typeof data === "object" && Object.keys(data).length === 0)) {
    return null;
  }
  return (
    <section className="border-b px-4 py-3">
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          Data
          <ChevronsUpDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {stringify(data)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function LinkDetails({ link, graph }: { link: LinkDto; graph: BuiltGraph }) {
  const client = graph.nodeById.get(link.clientNodeId);
  const server = graph.nodeById.get(link.serverNodeId);
  return (
    <div>
      <Section title="Link">
        <FieldRow label="ID">{link.id}</FieldRow>
        <FieldRow label="Flow ID">{link.flowId}</FieldRow>
        <FieldRow label="Protocol">{link.protocol}</FieldRow>
        <FieldRow label="Direction">{link.dataFlowDirection ?? "—"}</FieldRow>
        <FieldRow label="Principal ID">{link.principalId ?? "—"}</FieldRow>
        <FieldRow label="Inserted at">{link.insertedAt ?? "—"}</FieldRow>
        <FieldRow label="Updated at">{link.updatedAt ?? "—"}</FieldRow>
      </Section>
      <Section title="Client node">
        <FieldRow label="ID">{link.clientNodeId}</FieldRow>
        <FieldRow label="Name">{client?.name ?? "—"}</FieldRow>
        <FieldRow label="Type">{client?.nodeType ?? "—"}</FieldRow>
      </Section>
      <Section title="Server node">
        <FieldRow label="ID">{link.serverNodeId}</FieldRow>
        <FieldRow label="Name">{server?.name ?? "—"}</FieldRow>
        <FieldRow label="Type">{server?.nodeType ?? "—"}</FieldRow>
      </Section>
    </div>
  );
}
