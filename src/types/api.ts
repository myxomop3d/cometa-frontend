// Standard API response envelope
export interface ApiResponse<T> {
  count: number;
  data: T;
  messages: AppMessage[];
}

export interface AppMessage {
  semantic: "I" | "W" | "S" | "E";
  message: string;
  target: string | null;
  description: string | null;
}

export interface BoxDto {
  id: number;
  name: string;
  objectCode: string | null;
  shape: "O" | "X";
  num: number;
  item: ItemDto | null;
  things: ThingDto[] | null;
  oldItem: ItemDto | null;
  oldThings: ThingDto[] | null;
  dateStr: string;
  checkbox: boolean;
  tags: string[];
}

export interface ItemDto {
  id: number;
  name: string;
  status: "ON" | "OFF";
  date: string;
  count: number;
}

export interface ThingDto {
  id: number;
  name: string;
  status: "ON" | "OFF";
  date: string;
  count: number;
}

// AutomatedSystem
export interface AutomatedSystemDto {
  id: number;
  name: string;
  objectCode: string | null;
  fullName: string;
  ci: string;
  nameHpsm: string | null;
  leader: string;
  leaderSapId: string | null;
  block: string;
  tribe: string;
  cluster: string;
  clusterHpsmId: string | null;
  status: string | null;
  iftMailSupport: string | null;
  uatMailSupport: string | null;
  prodMailSupport: string | null;
  guid: string | null;
}

// Pagination & generic filters
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface SortByParams {
  sortBy?: string; // comma-separated: "name.asc,num.desc"
}

export type Filters<T> = Partial<T & PaginationParams>;
export type AutomatedSystemFilters = Filters<AutomatedSystemDto>;

// Box filters — standalone interface because filter params (ranges, relation IDs)
// don't map 1:1 to BoxDto fields, unlike AutomatedSystemFilters.
export interface BoxFilters extends Partial<PaginationParams> {
  // String contains
  name?: string;
  objectCode?: string;
  tags?: string;
  // Literal/enum
  shape?: "O" | "X";
  // Number range
  numMin?: number;
  numMax?: number;
  // Boolean
  checkbox?: boolean;
  // Date range
  dateStrFrom?: string;
  dateStrTo?: string;
  // Relations (store IDs)
  itemId?: number;
  thingIds?: number[];
  oldItemId?: number;
  oldThingIds?: number[];
}

// Node hierarchy
export interface NodeDto {
  id: number;
  dtoType: string;
  name: string;
  descriptionMd: string | null;
  interfaces?: InterfaceFlatDto[];
}

export interface NodeMicroserviceDto extends NodeDto {
  dtoType: "microservice";
  artifact: string;
  artifactVersion: string;
  imageVersion: string | null;
  gmsbGen: string | null;
  sourceUrl: string | null;
  configUrl: string | null;
  pelicanUrl: string | null;
  faultTolerance: string | null;
  scalability: string | null;
  loadBalancing: string | null;
  globalWhiteListHeaders: string | null;
  resourceProfile: string | null;
}

export interface NodeTopicDto extends NodeDto {
  dtoType: "topic";
  partitions: number;
  replicationFactor: number;
  compressionType: string;
  maxMessageBytes: number;
  retentionBytes: number;
  retentionMs: number;
}

export interface NodeEgressDto extends NodeDto {
  dtoType: "egress";
  realHosts: string;
  realPort: number;
  tls: string;
  virtualHost: string;
}

// Interface hierarchy
export interface InterfaceFlatDto {
  id: number;
  dtoType: string;
  name: string;
  protocol: string;
  segment: string;
  localWhiteListHeaders: string | null;
  descriptionMd: string | null;
  nodeId: number | null;
  linksInIds: number[] | null;
  linksOutIds: number[] | null;
}

export interface InterfaceKafkaClientFlatDto extends InterfaceFlatDto {
  dtoType: "kafkaClient";
  partitionKey: string | null;
  messageFormat: string;
  messageEncoding: string;
  messageHeaders: string | null;
  consumerGroup: string | null;
}

export interface InterfaceRestClientFlatDto extends InterfaceFlatDto {
  dtoType: "restClient";
  endpoint: string;
  httpMethod: string;
  requestFormat: string;
  responseFormat: string;
  xsdSchema: string | null;
  socketConnectionTimeout: number;
  socketReadTimeout: number;
  authentication: string;
  encryption: string;
  tlsVersion: string;
  errorsMd: string | null;
}

export interface InterfaceRestServerFlatDto extends InterfaceFlatDto {
  dtoType: "restServer";
  endpoint: string;
  httpMethod: string;
  requestFormat: string;
  responseFormat: string;
  xsdSchema: string | null;
  authentication: string;
  encryption: string;
  tlsVersion: string;
  envoyFilter: string | null;
  serverHostsMd: string | null;
  errorsMd: string | null;
}

// Link
export interface LinkDto {
  id: number;
  flowId: number;
  clientInterface: InterfaceFlatDto;
  serverInterface: InterfaceFlatDto;
  dataFlowDirection: string;
}

// FlowGraph
export interface FlowGraphDto {
  flow: FlowDto;
  nodes: NodeDto[];
  links: LinkDto[];
}

// Flow
export interface FlowDto {
  id: number;
  code: string;
  caption: string;
  integrity: "I_1" | "I_2" | "I_3" | "I_4" | null;
  confidentiality: "K_1" | "K_2" | "K_3" | "K_4" | null;
  dataClass: string;
  dataType: string;
  state: string;
  descriptionMd: string | null;
}

export interface FlowFilters extends Partial<PaginationParams> {
  code?: string;
  caption?: string;
  integrity?: string;
  confidentiality?: string;
  dataClass?: string;
  dataType?: string;
  state?: string;
}
