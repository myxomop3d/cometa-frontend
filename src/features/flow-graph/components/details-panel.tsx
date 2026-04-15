import type {
  NodeDto,
  InterfaceFlatDto,
  LinkDto,
  NodeMicroserviceDto,
  NodeTopicDto,
  NodeEgressDto,
  InterfaceKafkaClientFlatDto,
  InterfaceRestClientFlatDto,
  InterfaceRestServerFlatDto,
} from "@/types/api";
import { FieldRow } from "./field-row";
import { MarkdownBlock } from "./markdown-block";
import type { Selection, BuiltGraph } from "../types";

interface DetailsPanelProps {
  selection: Selection;
  graph: BuiltGraph;
}

export function DetailsPanel({ selection, graph }: DetailsPanelProps) {
  if (!selection) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a node, interface, or link to see its details.
      </div>
    );
  }

  if (selection.kind === "node") {
    const node = graph.nodeById.get(selection.id);
    if (!node) return <Missing />;
    return <NodeDetails node={node} />;
  }
  if (selection.kind === "interface") {
    const iface = graph.interfaceById.get(selection.id);
    if (!iface) return <Missing />;
    return <InterfaceDetails iface={iface} />;
  }
  const link = graph.linkById.get(selection.id);
  if (!link) return <Missing />;
  return <LinkDetails link={link} />;
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
      <Section title={`${node.dtoType} node`}>
        <FieldRow label="ID">{node.id}</FieldRow>
        <FieldRow label="Name">{node.name}</FieldRow>
        <FieldRow label="Type">{node.dtoType}</FieldRow>
      </Section>
      <Section title="Type-specific">{renderNodeTypeFields(node)}</Section>
      <Section title="Description">
        <MarkdownBlock value={node.descriptionMd} />
      </Section>
    </div>
  );
}

function renderNodeTypeFields(node: NodeDto) {
  if (node.dtoType === "microservice") {
    const n = node as NodeMicroserviceDto;
    return (
      <>
        <FieldRow label="Artifact">{n.artifact}</FieldRow>
        <FieldRow label="Artifact version">{n.artifactVersion}</FieldRow>
        <FieldRow label="Image version">{n.imageVersion ?? "—"}</FieldRow>
        <FieldRow label="GMSB gen">{n.gmsbGen ?? "—"}</FieldRow>
        <FieldRow label="Source URL">{n.sourceUrl ?? "—"}</FieldRow>
        <FieldRow label="Config URL">{n.configUrl ?? "—"}</FieldRow>
        <FieldRow label="Pelican URL">{n.pelicanUrl ?? "—"}</FieldRow>
        <FieldRow label="Fault tolerance">{n.faultTolerance ?? "—"}</FieldRow>
        <FieldRow label="Scalability">{n.scalability ?? "—"}</FieldRow>
        <FieldRow label="Load balancing">{n.loadBalancing ?? "—"}</FieldRow>
        <FieldRow label="Resource profile">{n.resourceProfile ?? "—"}</FieldRow>
      </>
    );
  }
  if (node.dtoType === "topic") {
    const n = node as NodeTopicDto;
    return (
      <>
        <FieldRow label="Partitions">{n.partitions}</FieldRow>
        <FieldRow label="Replication">{n.replicationFactor}</FieldRow>
        <FieldRow label="Compression">{n.compressionType}</FieldRow>
        <FieldRow label="Max message bytes">{n.maxMessageBytes}</FieldRow>
        <FieldRow label="Retention bytes">{n.retentionBytes}</FieldRow>
        <FieldRow label="Retention ms">{n.retentionMs}</FieldRow>
      </>
    );
  }
  if (node.dtoType === "egress") {
    const n = node as NodeEgressDto;
    return (
      <>
        <FieldRow label="Real hosts">{n.realHosts}</FieldRow>
        <FieldRow label="Real port">{n.realPort}</FieldRow>
        <FieldRow label="TLS">{n.tls}</FieldRow>
        <FieldRow label="Virtual host">{n.virtualHost}</FieldRow>
      </>
    );
  }
  return <FieldRow label="Info">No type-specific fields.</FieldRow>;
}

function InterfaceDetails({ iface }: { iface: InterfaceFlatDto }) {
  return (
    <div>
      <Section title={`${iface.dtoType} interface`}>
        <FieldRow label="ID">{iface.id}</FieldRow>
        <FieldRow label="Name">{iface.name}</FieldRow>
        <FieldRow label="Type">{iface.dtoType}</FieldRow>
        <FieldRow label="Protocol">{iface.protocol}</FieldRow>
        <FieldRow label="Segment">{iface.segment}</FieldRow>
        <FieldRow label="Node ID">{iface.nodeId ?? "—"}</FieldRow>
      </Section>
      <Section title="Type-specific">{renderInterfaceTypeFields(iface)}</Section>
      <Section title="Whitelist headers">
        <MarkdownBlock value={iface.localWhiteListHeaders} />
      </Section>
      <Section title="Description">
        <MarkdownBlock value={iface.descriptionMd} />
      </Section>
    </div>
  );
}

function renderInterfaceTypeFields(iface: InterfaceFlatDto) {
  if (iface.dtoType === "kafkaClient") {
    const i = iface as InterfaceKafkaClientFlatDto;
    return (
      <>
        <FieldRow label="Partition key">{i.partitionKey ?? "—"}</FieldRow>
        <FieldRow label="Message format">{i.messageFormat}</FieldRow>
        <FieldRow label="Message encoding">{i.messageEncoding}</FieldRow>
        <FieldRow label="Consumer group">{i.consumerGroup ?? "—"}</FieldRow>
        <FieldRow label="Message headers">
          <MarkdownBlock value={i.messageHeaders} />
        </FieldRow>
      </>
    );
  }
  if (iface.dtoType === "restClient") {
    const i = iface as InterfaceRestClientFlatDto;
    return (
      <>
        <FieldRow label="Endpoint">{i.endpoint}</FieldRow>
        <FieldRow label="HTTP method">{i.httpMethod}</FieldRow>
        <FieldRow label="Request format">{i.requestFormat}</FieldRow>
        <FieldRow label="Response format">{i.responseFormat}</FieldRow>
        <FieldRow label="Socket connect (ms)">{i.socketConnectionTimeout}</FieldRow>
        <FieldRow label="Socket read (ms)">{i.socketReadTimeout}</FieldRow>
        <FieldRow label="Authentication">{i.authentication}</FieldRow>
        <FieldRow label="Encryption">{i.encryption}</FieldRow>
        <FieldRow label="TLS version">{i.tlsVersion}</FieldRow>
        <FieldRow label="XSD">
          <MarkdownBlock value={i.xsdSchema} />
        </FieldRow>
        <FieldRow label="Errors">
          <MarkdownBlock value={i.errorsMd} />
        </FieldRow>
      </>
    );
  }
  if (iface.dtoType === "restServer") {
    const i = iface as InterfaceRestServerFlatDto;
    return (
      <>
        <FieldRow label="Endpoint">{i.endpoint}</FieldRow>
        <FieldRow label="HTTP method">{i.httpMethod}</FieldRow>
        <FieldRow label="Request format">{i.requestFormat}</FieldRow>
        <FieldRow label="Response format">{i.responseFormat}</FieldRow>
        <FieldRow label="Authentication">{i.authentication}</FieldRow>
        <FieldRow label="Encryption">{i.encryption}</FieldRow>
        <FieldRow label="TLS version">{i.tlsVersion}</FieldRow>
        <FieldRow label="Envoy filter">{i.envoyFilter ?? "—"}</FieldRow>
        <FieldRow label="Server hosts">
          <MarkdownBlock value={i.serverHostsMd} />
        </FieldRow>
        <FieldRow label="XSD">
          <MarkdownBlock value={i.xsdSchema} />
        </FieldRow>
        <FieldRow label="Errors">
          <MarkdownBlock value={i.errorsMd} />
        </FieldRow>
      </>
    );
  }
  return <FieldRow label="Info">No type-specific fields.</FieldRow>;
}

function LinkDetails({ link }: { link: LinkDto }) {
  return (
    <div>
      <Section title="Link">
        <FieldRow label="ID">{link.id}</FieldRow>
        <FieldRow label="Flow ID">{link.flowId}</FieldRow>
        <FieldRow label="Direction">{link.dataFlowDirection}</FieldRow>
      </Section>
      <Section title="Client interface">
        <FieldRow label="ID">{link.clientInterface.id}</FieldRow>
        <FieldRow label="Name">{link.clientInterface.name}</FieldRow>
        <FieldRow label="Type">{link.clientInterface.dtoType}</FieldRow>
      </Section>
      <Section title="Server interface">
        <FieldRow label="ID">{link.serverInterface.id}</FieldRow>
        <FieldRow label="Name">{link.serverInterface.name}</FieldRow>
        <FieldRow label="Type">{link.serverInterface.dtoType}</FieldRow>
      </Section>
    </div>
  );
}
