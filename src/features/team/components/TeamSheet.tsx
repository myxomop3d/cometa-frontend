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
import { PersonCombobox } from "@/features/person/components/PersonCombobox";
import type { TeamDto, AppMessage } from "@/types/api";

import { teamApi } from "../api";
import { teamFormSchema, type TeamFormValues } from "../schema";
import { teamDtoToForm, teamFormToCreate, teamFormToPatch } from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const TEAM_FORM_FIELDS: readonly (keyof TeamFormValues)[] = [
  "name",
  "code",
  "type",
  "leaderId",
  "leaderRole",
  "structure",
];

function isTeamField(target: string): target is keyof TeamFormValues {
  return (TEAM_FORM_FIELDS as readonly string[]).includes(target);
}

interface TeamSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  team: TeamDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function TeamSheet({
  team,
  variant,
  onSuccess,
  ...props
}: TeamSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: team
      ? teamDtoToForm(team)
      : {
          name: null,
          code: null,
          type: null,
          // 0 is never a valid id, so the schema's positive() rule reports
          // "Leader is required" if the user submits without picking one.
          leaderId: 0,
          leaderRole: null,
          structure: null,
        },
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      if (m.target && isTeamField(m.target)) {
        form.setError(m.target as Path<TeamFormValues>, { message: m.message });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: TeamFormValues) => {
      if (variant === "update" && team) {
        const patch = teamFormToPatch(data, form.formState.dirtyFields);
        return teamApi.patch(team.id, patch);
      }
      return teamApi.create(teamFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && team) {
        queryClient.setQueryData(["teams", "detail", team.id], res);
        toast.success("Team updated");
      } else {
        toast.success("Team created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save team");
        }
      } else {
        toast.error("Failed to save team");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Team" : "Add Team"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the team details and save changes."
              : "Fill in the details to create a new team."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Controller
              control={form.control}
              name="name"
              render={({ field }) => (
                <Input
                  id="name"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          {/* Code */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code</Label>
            <Controller
              control={form.control}
              name="code"
              render={({ field }) => (
                <Input
                  id="code"
                  type="number"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
            {form.formState.errors.code && (
              <p className="text-sm text-destructive">
                {form.formState.errors.code.message}
              </p>
            )}
          </div>

          {/* Type */}
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={(v) => field.onChange(v === "" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHANGE">CHANGE</SelectItem>
                    <SelectItem value="RUN">RUN</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Leader (required) */}
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

          {/* Leader Role */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="leaderRole">Leader Role</Label>
            <Controller
              control={form.control}
              name="leaderRole"
              render={({ field }) => (
                <Input
                  id="leaderRole"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          {/* Structure */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="structure">Structure</Label>
            <Controller
              control={form.control}
              name="structure"
              render={({ field }) => (
                <Input
                  id="structure"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

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
