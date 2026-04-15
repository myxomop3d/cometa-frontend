import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RelationPicker } from "@/components/relation-picker";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, ItemDto, ThingDto, AppMessage } from "@/types/api";
import type { ColumnDef } from "@tanstack/react-table";

import { boxApi } from "../api";
import { boxFormSchema, type BoxFormValues } from "../schema";
import { boxDtoToForm, boxFormToCreate, boxFormToPatch } from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const itemColumns: ColumnDef<ItemDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const thingColumns: ColumnDef<ThingDto, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

const BOX_FORM_FIELDS: readonly (keyof BoxFormValues)[] = [
  "name",
  "objectCode",
  "shape",
  "num",
  "dateStr",
  "checkbox",
  "itemId",
  "thingIds",
  "oldItemId",
  "oldThingIds",
];

function isBoxField(target: string): target is keyof BoxFormValues {
  return (BOX_FORM_FIELDS as readonly string[]).includes(target);
}

interface BoxSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  box: BoxDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function BoxSheet({ box, variant, onSuccess, ...props }: BoxSheetProps) {
  const queryClient = useQueryClient();

  // base-ui's `onOpenChange` signature requires an eventDetails object as the
  // second argument. When closing programmatically we don't have one; cast to
  // a 1-arg handler so TS doesn't complain.
  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<BoxFormValues>({
    resolver: zodResolver(boxFormSchema),
    defaultValues: box
      ? boxDtoToForm(box)
      : {
          name: "",
          objectCode: null,
          shape: "O",
          num: 0,
          dateStr: "",
          checkbox: false,
          itemId: null,
          thingIds: [],
          oldItemId: null,
          oldThingIds: [],
        },
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      if (m.target && isBoxField(m.target)) {
        form.setError(m.target as Path<BoxFormValues>, { message: m.message });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: BoxFormValues) => {
      if (variant === "update" && box) {
        const patch = boxFormToPatch(data, form.formState.dirtyFields);
        return boxApi.patch(box.id, patch);
      }
      return boxApi.create(boxFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && box) {
        queryClient.setQueryData(["boxes", "detail", box.id], res);
        toast.success("Box updated");
      } else {
        toast.success("Box created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save box");
        }
      } else {
        toast.error("Failed to save box");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Box" : "Add Box"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the box details and save changes."
              : "Fill in the details to create a new box."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Object Code */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="objectCode">Object Code</Label>
            <Controller
              control={form.control}
              name="objectCode"
              render={({ field }) => (
                <Input
                  id="objectCode"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          {/* Shape */}
          <div className="flex flex-col gap-2">
            <Label>Shape</Label>
            <Controller
              control={form.control}
              name="shape"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="O">O</SelectItem>
                    <SelectItem value="X">X</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Num */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="num">Num</Label>
            <Input
              id="num"
              type="number"
              {...form.register("num", { valueAsNumber: true })}
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dateStr">Date</Label>
            <Input id="dateStr" {...form.register("dateStr")} />
            {form.formState.errors.dateStr && (
              <p className="text-sm text-destructive">
                {form.formState.errors.dateStr.message}
              </p>
            )}
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="checkbox"
              render={({ field }) => (
                <Checkbox
                  id="checkbox"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="checkbox">Checkbox</Label>
          </div>

          {/* Item (relation) */}
          <div className="flex flex-col gap-2">
            <Label>Item</Label>
            <Controller
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <RelationPicker<ItemDto>
                  multi={false}
                  value={field.value ?? undefined}
                  onChange={(val) =>
                    field.onChange(typeof val === "number" ? val : null)
                  }
                  queryOptionsFn={(filters) =>
                    itemsFilteredQueryOptions(filters)
                  }
                  columns={itemColumns}
                  getLabel={(item) => item.name}
                  getId={(item) => item.id}
                  placeholder="Select item..."
                  variant="field"
                />
              )}
            />
          </div>

          {/* Things (multiRelation) */}
          <div className="flex flex-col gap-2">
            <Label>Things</Label>
            <Controller
              control={form.control}
              name="thingIds"
              render={({ field }) => (
                <RelationPicker<ThingDto>
                  multi={true}
                  value={field.value.length > 0 ? field.value : undefined}
                  onChange={(val) =>
                    field.onChange(
                      Array.isArray(val) ? val : val !== undefined ? [val] : [],
                    )
                  }
                  queryOptionsFn={(filters) =>
                    thingsFilteredQueryOptions(filters)
                  }
                  columns={thingColumns}
                  getLabel={(thing) => thing.name}
                  getId={(thing) => thing.id}
                  placeholder="Select things..."
                  variant="field"
                />
              )}
            />
          </div>

          {/* Old Item (relation) */}
          <div className="flex flex-col gap-2">
            <Label>Old Item</Label>
            <Controller
              control={form.control}
              name="oldItemId"
              render={({ field }) => (
                <RelationPicker<ItemDto>
                  multi={false}
                  value={field.value ?? undefined}
                  onChange={(val) =>
                    field.onChange(typeof val === "number" ? val : null)
                  }
                  queryOptionsFn={(filters) =>
                    itemsFilteredQueryOptions(filters)
                  }
                  columns={itemColumns}
                  getLabel={(item) => item.name}
                  getId={(item) => item.id}
                  placeholder="Select old item..."
                  variant="field"
                />
              )}
            />
          </div>

          {/* Old Things (multiRelation) */}
          <div className="flex flex-col gap-2">
            <Label>Old Things</Label>
            <Controller
              control={form.control}
              name="oldThingIds"
              render={({ field }) => (
                <RelationPicker<ThingDto>
                  multi={true}
                  value={field.value.length > 0 ? field.value : undefined}
                  onChange={(val) =>
                    field.onChange(
                      Array.isArray(val) ? val : val !== undefined ? [val] : [],
                    )
                  }
                  queryOptionsFn={(filters) =>
                    thingsFilteredQueryOptions(filters)
                  }
                  columns={thingColumns}
                  getLabel={(thing) => thing.name}
                  getId={(thing) => thing.id}
                  placeholder="Select old things..."
                  variant="field"
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
