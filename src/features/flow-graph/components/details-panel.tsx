import { ChevronsUpDown } from "lucide-react";
import { stringify } from "yaml";
import type { NodeDto, LinkDto } from "@/types/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { FieldRow } from "./field-row";
import type { Selection, BuiltGraph } from "../types";
import type { PairIndex, Pair } from "../pairs";

interface DetailsPanelProps {
  selection: Selection;
  graph: BuiltGraph;
  pairIndex: PairIndex;
  onShowNode: (crossGuid: string) => void;
  onHideNode: (nodeId: number) => void;
}

export function DetailsPanel({
  selection,
  graph,
  pairIndex,
  onShowNode,
  onHideNode,
}: DetailsPanelProps) {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node or link to see its details.
      </div>
    );
  }

  if (selection.kind === "mergedLink") {
    const pair = pairIndex.pairs.get(selection.crossGuid);
    if (!pair) return <Missing />;
    return <MergedLinkDetails pair={pair} graph={graph} onShowNode={onShowNode} />;
  }

  if (selection.kind === "node") {
    const node = graph.nodeById.get(selection.id);
    if (!node) return <Missing />;
    return (
      <NodeDetails
        node={node}
        hideable={pairIndex.hideableNodes.has(node.id)}
        onHideNode={onHideNode}
      />
    );
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

function NodeDetails({
  node,
  hideable,
  onHideNode,
}: {
  node: NodeDto;
  hideable: boolean;
  onHideNode: (nodeId: number) => void;
}) {
  return (
    <div>
      {hideable && (
        <div className="border-b px-4 py-3">
          <Button size="sm" variant="outline" onClick={() => onHideNode(node.id)}>
            Hide node
          </Button>
        </div>
      )}
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
          <FieldRow label="Leader">{node.automatedSystem.leaderComment ?? "—"}</FieldRow>
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
        <FieldRow label="Cross GUID">{link.crossGuid}</FieldRow>
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

function MergedLinkDetails({
  pair,
  graph,
  onShowNode,
}: {
  pair: Pair;
  graph: BuiltGraph;
  onShowNode: (crossGuid: string) => void;
}) {
  const proxy = graph.nodeById.get(pair.proxyNodeId);
  const outerSource = graph.nodeById.get(pair.outerSourceId);
  const outerTarget = graph.nodeById.get(pair.outerTargetId);
  return (
    <div>
      <div className="border-b px-4 py-3">
        <Button size="sm" onClick={() => onShowNode(pair.crossGuid)}>
          Show node
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Proxy link — collapses {outerSource?.name ?? pair.outerSourceId} →{" "}
          {proxy?.name ?? pair.proxyNodeId} → {outerTarget?.name ?? pair.outerTargetId}.
        </p>
      </div>
      <LinkSubSection title="Link into proxy" link={pair.linkIn} />
      <LinkSubSection title="Link out of proxy" link={pair.linkOut} />
      <section className="border-b px-4 py-3">
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Proxy node
            <ChevronsUpDown className="size-3.5" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {proxy ? (
              <dl className="mt-2">
                <FieldRow label="ID">{proxy.id}</FieldRow>
                <FieldRow label="Name">{proxy.name}</FieldRow>
                <FieldRow label="Type">{proxy.nodeType}</FieldRow>
                <FieldRow label="Environment">{proxy.environment}</FieldRow>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Proxy node not found.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </section>
    </div>
  );
}

function LinkSubSection({ title, link }: { title: string; link: LinkDto }) {
  return (
    <Section title={title}>
      <FieldRow label="ID">{link.id}</FieldRow>
      <FieldRow label="Protocol">{link.protocol}</FieldRow>
      <FieldRow label="Direction">{link.dataFlowDirection ?? "—"}</FieldRow>
      <FieldRow label="Cross GUID">{link.crossGuid}</FieldRow>
    </Section>
  );
}
