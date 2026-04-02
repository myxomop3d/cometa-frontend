import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBox } from "@/api/box";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const createBoxSchema = z.object({
  name: z.string().min(1, "Name is required"),
  objectCode: z.string().optional(),
  shape: z.enum(["O", "X"]),
  num: z.coerce.number(),
  dateStr: z.string().min(1, "Date is required"),
  checkbox: z.boolean(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof createBoxSchema>;

interface AddBoxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBoxDialog({ open, onOpenChange }: AddBoxDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createBoxSchema),
    defaultValues: {
      name: "",
      objectCode: "",
      shape: "O",
      num: 0,
      dateStr: new Date().toISOString().split("T")[0],
      checkbox: false,
      tags: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createBox,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boxes"] });
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({
      name: data.name,
      objectCode: data.objectCode || null,
      shape: data.shape,
      num: data.num,
      dateStr: data.dateStr,
      checkbox: data.checkbox,
      tags: data.tags
        ? data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    });
  };

  const shapeValue = watch("shape");
  const checkboxValue = watch("checkbox");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Box</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="objectCode">Object Code</Label>
            <Input id="objectCode" {...register("objectCode")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Shape *</Label>
            <Select
              value={shapeValue}
              onValueChange={(v) => setValue("shape", v as "O" | "X")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="O">O</SelectItem>
                <SelectItem value="X">X</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="num">Num *</Label>
            <Input
              id="num"
              type="number"
              {...register("num", { valueAsNumber: true })}
            />
            {errors.num && (
              <p className="text-sm text-destructive">{errors.num.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dateStr">Date *</Label>
            <Input id="dateStr" type="date" {...register("dateStr")} />
            {errors.dateStr && (
              <p className="text-sm text-destructive">
                {errors.dateStr.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="checkbox"
              checked={checkboxValue}
              onCheckedChange={(checked) =>
                setValue("checkbox", checked === true)
              }
            />
            <Label htmlFor="checkbox">Checkbox</Label>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" {...register("tags")} placeholder="tag1, tag2" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
