import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
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
import { patchBox, createBox } from "@/api/box";
import { itemsFilteredQueryOptions } from "@/api/item";
import { thingsFilteredQueryOptions } from "@/api/thing";
import type { BoxDto, ItemDto, ThingDto } from "@/types/api";
import type { ColumnDef } from "@tanstack/react-table";

const boxFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z.string().nullable(),
  shape: z.enum(["O", "X"]),
  num: z.number(),
  dateStr: z.string(),
  checkbox: z.boolean(),
  itemId: z.number().nullable(),
  thingIds: z.array(z.number()),
  oldItemId: z.number().nullable(),
  oldThingIds: z.array(z.number()),
});

type BoxFormValues = z.infer<typeof boxFormSchema>;

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

interface BoxSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  box: BoxDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function BoxSheet({ box, variant, onSuccess, ...props }: BoxSheetProps) {
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<BoxFormValues>({
    resolver: zodResolver(boxFormSchema),
    defaultValues: {
      name: box?.name ?? "",
      objectCode: box?.objectCode ?? null,
      shape: box?.shape ?? "O",
      num: box?.num ?? 0,
      dateStr: box?.dateStr ?? "",
      checkbox: box?.checkbox ?? false,
      itemId: box?.item?.id ?? null,
      thingIds: box?.things?.map((t) => t.id) ?? [],
      oldItemId: box?.oldItem?.id ?? null,
      oldThingIds: box?.oldThings?.map((t) => t.id) ?? [],
    },
  });

  // Reset form when box changes
  React.useEffect(() => {
    form.reset({
      name: box?.name ?? "",
      objectCode: box?.objectCode ?? null,
      shape: box?.shape ?? "O",
      num: box?.num ?? 0,
      dateStr: box?.dateStr ?? "",
      checkbox: box?.checkbox ?? false,
      itemId: box?.item?.id ?? null,
      thingIds: box?.things?.map((t) => t.id) ?? [],
      oldItemId: box?.oldItem?.id ?? null,
      oldThingIds: box?.oldThings?.map((t) => t.id) ?? [],
    });
  }, [box, form]);

  function onSubmit(data: BoxFormValues) {
    startTransition(async () => {
      try {
        if (variant === "update" && box) {
          await patchBox(box.id, data);
          toast.success("Box updated");
        } else {
          await createBox(data);
          toast.success("Box created");
        }
        onSuccess();
        props.onOpenChange?.(false);
      } catch {
        toast.error("Failed to save box");
      }
    });
  }

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
          onSubmit={form.handleSubmit(onSubmit)}
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
            <Input id="objectCode" {...form.register("objectCode")} />
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
                  onChange={(val) => field.onChange(val ?? null)}
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
                  onChange={(val) => field.onChange(val ?? null)}
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
              onClick={() => props.onOpenChange?.(false)}
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
