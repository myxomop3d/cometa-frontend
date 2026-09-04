import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Control, type Path } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PersonCombobox } from "@/features/person/components/PersonCombobox";
import type { AutomatedSystemDto, AppMessage } from "@/types/api";

import { automatedSystemApi } from "../api";
import {
  automatedSystemFormSchema,
  type AutomatedSystemFormValues,
} from "../schema";
import {
  automatedSystemDtoToForm,
  automatedSystemFormToCreate,
  automatedSystemFormToPatch,
} from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

/** Every nullable free-text field, i.e. all form fields except `name`
 *  (required), `leaderId` (combobox) and `status` (select). */
type NullableTextField = Exclude<
  keyof AutomatedSystemFormValues,
  "name" | "leaderId" | "status"
>;

const PRIMARY_TEXT_FIELDS: { name: NullableTextField; label: string }[] = [
  { name: "fullName", label: "Full Name" },
  { name: "objectCode", label: "Object Code" },
  { name: "ci", label: "CI" },
  { name: "nameHpsm", label: "HPSM Name" },
  { name: "leaderComment", label: "Leader (text)" },
  { name: "leaderSapId", label: "Leader SAP ID" },
  { name: "block", label: "Block" },
  { name: "tribe", label: "Tribe" },
  { name: "cluster", label: "Cluster" },
  { name: "clusterHpsmId", label: "Cluster HPSM ID" },
];

const SUPPORT_TEXT_FIELDS: { name: NullableTextField; label: string }[] = [
  { name: "iftMailSupport", label: "IFT Mail Support" },
  { name: "uatMailSupport", label: "UAT Mail Support" },
  { name: "prodMailSupport", label: "Prod Mail Support" },
  { name: "guid", label: "GUID" },
];

const AS_FORM_FIELDS: readonly (keyof AutomatedSystemFormValues)[] = [
  "name",
  "objectCode",
  "fullName",
  "ci",
  "nameHpsm",
  "leaderId",
  "leaderComment",
  "leaderSapId",
  "block",
  "tribe",
  "cluster",
  "clusterHpsmId",
  "status",
  "iftMailSupport",
  "uatMailSupport",
  "prodMailSupport",
  "guid",
];

function isAutomatedSystemField(
  target: string,
): target is keyof AutomatedSystemFormValues {
  return (AS_FORM_FIELDS as readonly string[]).includes(target);
}

const EMPTY_FORM: AutomatedSystemFormValues = {
  name: "",
  objectCode: null,
  fullName: null,
  ci: null,
  nameHpsm: null,
  // 0 is never a valid id, so the schema's positive() rule reports
  // "Leader is required" if the user submits without picking one.
  leaderId: 0,
  leaderComment: null,
  leaderSapId: null,
  block: null,
  tribe: null,
  cluster: null,
  clusterHpsmId: null,
  status: null,
  iftMailSupport: null,
  uatMailSupport: null,
  prodMailSupport: null,
  guid: null,
};

function NullableTextRow({
  control,
  name,
  label,
}: {
  control: Control<AutomatedSystemFormValues>;
  name: NullableTextField;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <>
            <Input
              id={name}
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value === "" ? null : e.target.value)
              }
              onBlur={field.onBlur}
            />
            {fieldState.error && (
              <p className="text-sm text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />
    </div>
  );
}

interface AutomatedSystemSheetProps
  extends React.ComponentPropsWithRef<typeof Sheet> {
  automatedSystem: AutomatedSystemDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function AutomatedSystemSheet({
  automatedSystem,
  variant,
  onSuccess,
  ...props
}: AutomatedSystemSheetProps) {
  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<AutomatedSystemFormValues>({
    resolver: zodResolver(automatedSystemFormSchema),
    defaultValues: automatedSystem
      ? automatedSystemDtoToForm(automatedSystem)
      : EMPTY_FORM,
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      // The DTO field is `leader`; the form field is `leaderId`.
      const target = m.target === "leader" ? "leaderId" : m.target;
      if (target && isAutomatedSystemField(target)) {
        form.setError(target as Path<AutomatedSystemFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: AutomatedSystemFormValues) => {
      if (variant === "update" && automatedSystem) {
        const patch = automatedSystemFormToPatch(data, form.formState.dirtyFields);
        return automatedSystemApi.patch(automatedSystem.id, patch);
      }
      return automatedSystemApi.create(automatedSystemFormToCreate(data));
    },
    onSuccess: () => {
      if (variant === "update" && automatedSystem) {
        // The PATCH response comes from the plain `{id}` path, which does not
        // honour `$fields` and so always carries `leader: null` (see ../api.ts).
        // Caching it would seed the detail key with a leader-less DTO; the page
        // invalidates the whole ["automated-systems"] key on success instead.
        toast.success("Automated system updated");
      } else {
        toast.success("Automated system created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save automated system");
        }
      } else {
        toast.error("Failed to save automated system");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update"
              ? "Edit Automated System"
              : "Add Automated System"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the automated system details and save changes."
              : "Fill in the details to create a new automated system."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Name (required) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Controller
              control={form.control}
              name="name"
              render={({ field }) => (
                <Input
                  id="name"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                />
              )}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Leader (required — the FK is NOT NULL) */}
          <div className="flex flex-col gap-2">
            <Label>Leader</Label>
            <Controller
              control={form.control}
              name="leaderId"
              render={({ field }) => (
                <PersonCombobox
                  value={field.value > 0 ? field.value : null}
                  onChange={(id) => field.onChange(id ?? 0)}
                />
              )}
            />
            {form.formState.errors.leaderId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.leaderId.message}
              </p>
            )}
          </div>

          {PRIMARY_TEXT_FIELDS.map((f) => (
            <NullableTextRow
              key={f.name}
              control={form.control}
              name={f.name}
              label={f.label}
            />
          ))}

          {/* Status */}
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Находится в эксплуатации">
                      Находится в эксплуатации
                    </SelectItem>
                    <SelectItem value="Выведен из эксплуатации">
                      Выведен из эксплуатации
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.status && (
              <p className="text-sm text-destructive">
                {form.formState.errors.status.message}
              </p>
            )}
          </div>

          {SUPPORT_TEXT_FIELDS.map((f) => (
            <NullableTextRow
              key={f.name}
              control={form.control}
              name={f.name}
              label={f.label}
            />
          ))}

          <SheetFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => closeSheet()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              )}
              {variant === "update" ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
