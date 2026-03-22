import type { ZodSchema } from "zod";

export interface TextFieldConfig {
  type: "text";
}

export interface NumberFieldConfig {
  type: "number";
}

export interface SelectFieldConfig {
  type: "select";
  options: { label: string; value: string }[];
}

export interface CheckboxFieldConfig {
  type: "checkbox";
}

export type EditFieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | SelectFieldConfig
  | CheckboxFieldConfig;

export interface EditConfig<TData> {
  /** Field type definitions. All editable fields should be explicitly listed. */
  fields: Partial<Record<keyof TData, EditFieldConfig>>;

  /** Fields that render as read-only even in edit mode. Include the identity field here. */
  disabledFields?: (keyof TData)[];

  /** Zod schema to validate editable fields. */
  schema: ZodSchema;

  /** Called on save with the row ID and the full merged row data. Reject to trigger error toast. */
  onSave: (rowId: string | number, data: TData) => Promise<void>;

  /** Extracts the unique row identity from the data. */
  rowId: (row: TData) => string | number;
}
