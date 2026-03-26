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
  dateStr: string;
  checkbox: boolean;
  tags: string[];
}

export interface ItemDto {
  id: number;
  name: string;
}

export interface ThingDto {
  id: number;
  name: string;
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
}

// Node hierarchy
export interface NodeDto {
  id: number;
  dtoType: string;
  name: string;
  interfaces?: NodeInterfaceFlatDto[];
}

export interface MicroserviceNodeDto extends NodeDto {
  dtoType: "MicroserviceNodeDto";
  version: string;
  artifactId: string;
}

export interface TopicNodeDto extends NodeDto {
  dtoType: "TopicNodeDto";
  param: string;
  papam2: string;
}

// Interface hierarchy
export interface NodeInterfaceFlatDto {
  id: number;
  dtoType: string;
  name: string;
  protocol: string;
  segment: string;
  nodeId: number;
  linksInIds: number[];
  linksOutIds: number[];
}

export interface KafkaClientInterfaceFlatDto extends NodeInterfaceFlatDto {
  dtoType: "KafkaClientInterfaceFlatDto";
  compressionType: string;
}

export interface KafkaServerInterfaceFlatDto extends NodeInterfaceFlatDto {
  dtoType: "KafkaServerInterfaceFlatDto";
  replicas: number;
  partitions: number;
  partitionKey: number;
}

export interface RestClientInterfaceFlatDto extends NodeInterfaceFlatDto {
  dtoType: "RestClientInterfaceFlatDto";
  http_method: string;
  requestFormat: string;
}

export interface RestServerInterfaceFlatDto extends NodeInterfaceFlatDto {
  dtoType: "RestServerInterfaceFlatDto";
  timeout: number;
  responseFormat: string;
}

// Link
export interface LinkDto {
  id: number;
  flowId: number;
  clientInterface: NodeInterfaceFlatDto;
  serverInterface: NodeInterfaceFlatDto;
  dataFlowDirection: string;
}

// FlowGraph
export interface FlowGraphDto {
  flowId: number;
  nodes: NodeDto[];
  links: LinkDto[];
}
