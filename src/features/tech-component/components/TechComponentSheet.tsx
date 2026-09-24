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
import { AutomatedSystemCombobox } from "@/features/automated-system/components/AutomatedSystemCombobox";
import { ApiError } from "@/lib/api/create-crud-api";
import type { AppMessage, TechComponentDto } from "@/types/api";

import { techComponentApi } from "../api";
import {
  TECH_COMPONENT_ENVIRONMENTS,
  techComponentFormSchema,
  type TechComponentFormDefaults,
  type TechComponentFormValues,
} from "../schema";
import {
  techComponentDtoToForm,
  techComponentFormToCreate,
  techComponentFormToPatch,
} from "../mappers";

type TextField = "name" | "groupName" | "technology" | "consoleUrl" | "infoUrl";

const TC_FORM_FIELDS: readonly (keyof TechComponentFormValues)[] = [
  "groupName",
  "name",
  "technology",
  "environment",
  "automatedSystemId",
  "consoleUrl",
  "infoUrl",
];

function isTechComponentField(
  target: string,
): target is keyof TechComponentFormValues {
  return (TC_FORM_FIELDS as readonly string[]).includes(target);
}

const EMPTY_FORM: TechComponentFormDefaults = {
  groupName: "",
  name: "",
  technology: "",
  // Nothing picked yet; the schema reports "… is required".
  environment: undefined,
  // Not 0 — 0 is the "Not set" sentinel row (DDL 021), a valid pick.
  automatedSystemId: undefined,
  consoleUrl: "",
  infoUrl: "",
};

function TextRow({
  control,
  name,
  label,
}: {
  control: Control<TechComponentFormValues>;
  name: TextField;
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
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
            />
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </>
        )}
      />
    </div>
  );
}

interface TechComponentSheetProps
  extends React.ComponentPropsWithRef<typeof Sheet> {
  techComponent: TechComponentDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function TechComponentSheet({
  techComponent,
  variant,
  onSuccess,
  ...props
}: TechComponentSheetProps) {
  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<TechComponentFormValues>({
    resolver: zodResolver(techComponentFormSchema),
    defaultValues: techComponent ? techComponentDtoToForm(techComponent) : EMPTY_FORM,
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      // The DTO field is `automatedSystem`; the form field is `automatedSystemId`.
      const target = m.target === "automatedSystem" ? "automatedSystemId" : m.target;
      if (target && isTechComponentField(target)) {
        form.setError(target as Path<TechComponentFormValues>, { message: m.message });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: TechComponentFormValues) => {
      if (variant === "update" && techComponent) {
        const patch = techComponentFormToPatch(data, form.formState.dirtyFields);
        return techComponentApi.patch(techComponent.id, patch);
      }
      return techComponentApi.create(techComponentFormToCreate(data));
    },
    onSuccess: () => {
      // The PATCH/POST response comes from the plain path, which does not
      // honour `$fields` (automatedSystem: null); the page invalidates the
      // whole ["tech-components"] key instead of caching it.
      toast.success(
        variant === "update" ? "Tech component updated" : "Tech component created",
      );
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        // A duplicate (name, environment) lands here as a DB unique violation.
        if (!applyServerErrors(err.messages)) {
          toast.error(err.message || "Failed to save tech component");
        }
      } else {
        toast.error("Failed to save tech component");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Tech Component" : "Add Tech Component"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the tech component details and save changes."
              : "Fill in the details to create a new tech component."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          <TextRow control={form.control} name="name" label="Name" />
          <TextRow control={form.control} name="groupName" label="Group" />

          {/* Environment (required, enum) */}
          <div className="flex flex-col gap-2">
            <Label>Environment</Label>
            <Controller
              control={form.control}
              name="environment"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TECH_COMPONENT_ENVIRONMENTS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.environment && (
              <p className="text-sm text-destructive">
                {form.formState.errors.environment.message}
              </p>
            )}
          </div>

          {/* Automated System (required; "Not set" is the id-0 row) */}
          <div className="flex flex-col gap-2">
            <Label>Automated System</Label>
            <Controller
              control={form.control}
              name="automatedSystemId"
              render={({ field }) => (
                <AutomatedSystemCombobox
                  value={field.value ?? null}
                  onChange={(id) => field.onChange(id ?? undefined)}
                />
              )}
            />
            {form.formState.errors.automatedSystemId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.automatedSystemId.message}
              </p>
            )}
          </div>

          <TextRow control={form.control} name="technology" label="Technology" />
          <TextRow control={form.control} name="consoleUrl" label="Console URL" />
          <TextRow control={form.control} name="infoUrl" label="Info URL" />

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
