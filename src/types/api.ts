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

// Node
export type EnvironmentCode = "DEV" | "IFT" | "UAT" | "PROD";
export type NodeType = "NODE" | "MICROSERVICE" | "TOPIC" | "EGRESS" | "INGRESS";

export interface NodeDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  nodeType: NodeType;
  name: string;
  environment: EnvironmentCode;
  automatedSystem: AutomatedSystemDto | null;
  data?: unknown; // JSONB config (application.yml etc.) — rendered as YAML, not typed
}

// Link
export type LinkProtocol = "DB" | "KAFKA" | "REST" | "SOAP" | "TFS" | "LDAP" | "common";

export interface LinkDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  flowId: number;
  clientNodeId: number;
  serverNodeId: number;
  protocol: LinkProtocol;
  dataFlowDirection: string | null;
  principalId: number | null;
}

// FlowGraph
export interface FlowGraphDto {
  flowId: number;
  env: EnvironmentCode;
  nodes: NodeDto[];
  links: LinkDto[];
}

// Flow
export interface FlowDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  key: string;
  caption: string;
  integrity: string | null;
  confidentiality: string | null;
  secretClass: string | null;
  dataClass: string;
  dataType: string;
  description: string | null;
}

export interface FlowFilters extends Partial<PaginationParams> {
  key?: string;
  caption?: string;
  integrity?: string;
  confidentiality?: string;
  dataClass?: string;
  dataType?: string;
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

export interface LoginRequest {
  sigmaLogin: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface UserProfile {
  sigmaLogin: string;
  authorities: string[];
}
