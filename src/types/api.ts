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
  itemId: number | null;
  things: ThingDto[] | null;
  oldItem: ItemDto | null;
  oldItemId: number | null;
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
/** Flat = every scalar of the entity, none of its relations. On day one no
 *  field is typed as this: it is the interface holding the 16 scalars, which
 *  AutomatedSystemDto extends. Not dead code — see the "Rejected" section of
 *  docs/superpowers/specs/2026-09-04-automated-system-leader-relation-design.md */
/** Every text field is non-null: `014_no_null_text_columns.sql` made these
 *  columns NOT NULL DEFAULT ''. Empty is "", never null.
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
export interface AutomatedSystemFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string;
  objectCode: string;
  fullName: string;
  ci: string;
  nameHpsm: string;
  /** Historical free-text lead. The DB column is still named `leader`;
   *  only the Java field and this DTO field were renamed. */
  leaderComment: string;
  leaderSapId: string;
  block: string;
  tribe: string;
  cluster: string;
  clusterHpsmId: string;
  status: string;
  iftMailSupport: string;
  uatMailSupport: string;
  prodMailSupport: string;
  guid: string;
}

export interface AutomatedSystemDto extends AutomatedSystemFlatDto {
  /** Read: populated only with ?$fields=leader. Write: only `id`.
   *  NOT NULL in the DB, yet null on any read that omits $fields. */
  leader: PersonFlatDto | null;
}

// Pagination & generic filters
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface SortByParams {
  sortBy?: string; // comma-separated: "name.asc,num.desc"
}

/** URL search-param names, not DTO fields — the generic `Filters<AutomatedSystemDto>`
 *  form could not survive `leader` becoming an object, and filter keys are URL
 *  contract. Same shape as `TeamFilters` below. */
export interface AutomatedSystemFilters extends Partial<PaginationParams> {
  name?: string;
  ci?: string;
  block?: string;
  tribe?: string;
  cluster?: string;
  status?: string;
  leaderComment?: string;
  /** URL search-param name, not a DTO field. */
  leaderId?: number;
}

// Box filters — standalone interface because filter params (ranges, relation IDs)
// don't map 1:1 to BoxDto fields, unlike a DTO-derived filter type.
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

/**
 * Direction of data flow relative to the client/server roles.
 * - CODIRECTIONAL: client → server
 * - COUNTERDIRECTIONAL: server → client
 * - BIDIRECTIONAL: client → server, then back server → client
 */
export type DataFlowDirection = "CODIRECTIONAL" | "COUNTERDIRECTIONAL" | "BIDIRECTIONAL";

export interface LinkDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  flowId: number;
  clientNodeId: number;
  serverNodeId: number;
  protocol: LinkProtocol;
  dataFlowDirection: DataFlowDirection | null;
  principalId: number | null;
  crossGuid: string;
}

// FlowGraph
export interface FlowGraphDto {
  flowId: number;
  env: EnvironmentCode;
  nodes: NodeDto[];
  links: LinkDto[];
}

// Flow
/** Every text field is non-null: `flow.integrity`, `flow.confidentiality`,
 *  `flow.secret_class` and `flow.description` are NOT NULL DEFAULT ''.
 *  Standard: docs/superpowers/specs/2026-09-09-no-null-write-standard-design.md */
export interface FlowDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  key: string;
  caption: string;
  integrity: string;
  confidentiality: string;
  secretClass: string;
  dataClass: string;
  dataType: string;
  description: string;
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

// ────────────────────────────────────────────────────────────
// Registration
// ────────────────────────────────────────────────────────────

/** Flat = every scalar of the entity, none of its relations. This is the shape
 *  a parent uses to reference a child. On write only `id` is read; every other
 *  field is ignored, because a parent may never modify a child's fields.
 *  See docs/superpowers/specs/2026-08-27-nested-relation-write-standard-design.md */
export interface PersonFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
}

export interface PersonDto extends PersonFlatDto {
  /** Read: populated only on /api/v1/person/graph?$fields=teams.
   *  Write: only each element's `id` is honoured. Absent = unchanged,
   *  [] = clear all, non-empty = full replace. */
  teams?: TeamFlatDto[];
}

export interface PersonFilters extends Partial<PaginationParams> {
  email?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
}

export interface TeamFlatDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string;
  code: string;
  type: string | null;
  leaderRole: string;
  structure: string;
}

export interface TeamDto extends TeamFlatDto {
  /** Read: populated only with ?$fields=leader — which is why the leader's id
   *  is no longer available on requests that omit it. Write: only `id`. */
  leader: PersonFlatDto | null;
}

export interface TeamFilters extends Partial<PaginationParams> {
  name?: string;
  code?: string;
  type?: string;
  /** URL search-param name, not a DTO field. Unaffected by the leaderId removal. */
  leaderId?: number;
  leaderRole?: string;
  structure?: string;
}

export interface RegisterRequest {
  sigmaLogin: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  password: string;
  teamId: number | null;
}

export interface CheckSigmaLoginResponse {
  exists: boolean;
}

export interface PersonByEmailResponse {
  person: PersonDto | null;
  hasAccount: boolean;
}
