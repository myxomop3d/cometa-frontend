import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import type { FlowDto, AppMessage } from "@/types/api";

import { flowApi } from "../api";
import { flowFormSchema, type FlowFormValues } from "../schema";
import { flowDtoToForm, flowFormToCreate, flowFormToPatch } from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const FLOW_FORM_FIELDS: readonly (keyof FlowFormValues)[] = [
  "code",
  "caption",
  "integrity",
  "confidentiality",
  "secretClass",
  "dataClass",
  "dataType",
  "description",
];

function isFlowField(target: string): target is keyof FlowFormValues {
  return (FLOW_FORM_FIELDS as readonly string[]).includes(target);
}

interface FlowSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  flow: FlowDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function FlowSheet({
  flow,
  variant,
  onSuccess,
  ...props
}: FlowSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<FlowFormValues>({
    resolver: zodResolver(flowFormSchema),
    defaultValues: flow
      ? flowDtoToForm(flow)
      : {
          code: "",
          caption: "",
          integrity: null,
          confidentiality: null,
          secretClass: null,
          dataClass: "",
          dataType: "",
          description: null,
        },
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      if (m.target && isFlowField(m.target)) {
        form.setError(m.target as Path<FlowFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: FlowFormValues) => {
      if (variant === "update" && flow) {
        const patch = flowFormToPatch(data, form.formState.dirtyFields);
        return flowApi.patch(flow.id, patch);
      }
      return flowApi.create(flowFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && flow) {
        queryClient.setQueryData(["flows", "detail", flow.id], res);
        toast.success("Flow updated");
      } else {
        toast.success("Flow created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save flow");
        }
      } else {
        toast.error("Failed to save flow");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Flow" : "Add Flow"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the flow details and save changes."
              : "Fill in the details to create a new flow."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Code */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" {...form.register("code")} />
            {form.formState.errors.code && (
              <p className="text-sm text-destructive">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          {/* Caption */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="caption">Caption</Label>
            <Input id="caption" {...form.register("caption")} />
            {form.formState.errors.caption && (
              <p className="text-sm text-destructive">
                {form.formState.errors.caption.message}
              </p>
            )}
          </div>

          {/* Integrity */}
          <div className="flex flex-col gap-2">
            <Label>Integrity</Label>
            <Controller
              control={form.control}
              name="integrity"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select integrity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I_1">I_1</SelectItem>
                    <SelectItem value="I_2">I_2</SelectItem>
                    <SelectItem value="I_3">I_3</SelectItem>
                    <SelectItem value="I_4">I_4</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Confidentiality */}
          <div className="flex flex-col gap-2">
            <Label>Confidentiality</Label>
            <Controller
              control={form.control}
              name="confidentiality"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select confidentiality..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="K_1">K_1</SelectItem>
                    <SelectItem value="K_2">K_2</SelectItem>
                    <SelectItem value="K_3">K_3</SelectItem>
                    <SelectItem value="K_4">K_4</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Secret Class */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="secretClass">Secret Class</Label>
            <Controller
              control={form.control}
              name="secretClass"
              render={({ field }) => (
                <Input
                  id="secretClass"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          {/* Data Class */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataClass">Data Class</Label>
            <Input id="dataClass" {...form.register("dataClass")} />
            {form.formState.errors.dataClass && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dataClass.message}
              </p>
            )}
          </div>

          {/* Data Type */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataType">Data Type</Label>
            <Input id="dataType" {...form.register("dataType")} />
            {form.formState.errors.dataType && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dataType.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <Textarea
                  id="description"
                  rows={4}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? null : e.target.value,
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <SheetFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => closeSheet()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader
                  className="mr-2 size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {variant === "update" ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
