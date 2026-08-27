import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "lucide-react";
import * as React from "react";
import { useForm, Controller, type Path } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RelationPicker } from "@/components/relation-picker";
import { teamsFilteredQueryOptions } from "@/features/team/api";
import type { PersonDto, AppMessage, TeamDto } from "@/types/api";

import { personApi } from "../api";
import {
  personFormSchema,
  EMPTY_PERSON_FORM,
  type PersonFormValues,
} from "../schema";
import {
  personDtoToForm,
  personFormToCreate,
  personFormToPatch,
} from "../mappers";
import { ApiError } from "@/lib/api/create-crud-api";

const PERSON_FORM_FIELDS: readonly (keyof PersonFormValues)[] = [
  "email",
  "lastName",
  "firstName",
  "middleName",
  "teamIds",
];

// Mirrors `teamRelationColumns` in `src/features/person/columns.tsx` so the
// picker in this sheet and the picker in the toolbar filter look identical.
const teamRelationColumns: ColumnDef<TeamDto, unknown>[] = [
  { accessorKey: "id", header: "ID", size: 80 },
  { accessorKey: "name", header: "Name" },
];

function isPersonField(target: string): target is keyof PersonFormValues {
  return (PERSON_FORM_FIELDS as readonly string[]).includes(target);
}

interface PersonSheetProps extends React.ComponentPropsWithRef<typeof Sheet> {
  person: PersonDto | null;
  variant: "update" | "create";
  onSuccess: () => void;
}

export function PersonSheet({
  person,
  variant,
  onSuccess,
  ...props
}: PersonSheetProps) {
  const queryClient = useQueryClient();

  const closeSheet = React.useCallback(() => {
    (props.onOpenChange as ((open: boolean) => void) | undefined)?.(false);
  }, [props.onOpenChange]);

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: person ? personDtoToForm(person) : EMPTY_PERSON_FORM,
  });

  function applyServerErrors(messages: AppMessage[]): boolean {
    let hadFieldError = false;
    for (const m of messages) {
      if (m.semantic !== "E") continue;
      const target = m.target === "teams" ? "teamIds" : m.target;
      if (target && isPersonField(target)) {
        form.setError(target as Path<PersonFormValues>, {
          message: m.message,
        });
        hadFieldError = true;
      }
    }
    return hadFieldError;
  }

  const mutation = useMutation({
    mutationFn: async (data: PersonFormValues) => {
      if (variant === "update" && person) {
        const patch = personFormToPatch(
          data,
          form.formState.dirtyFields,
          person.teams?.map((t) => t.id) ?? [],
        );
        return personApi.patch(person.id, patch);
      }
      return personApi.create(personFormToCreate(data));
    },
    onSuccess: (res) => {
      if (variant === "update" && person) {
        queryClient.setQueryData(["persons", "detail", person.id], res);
        toast.success("Person updated");
      } else {
        toast.success("Person created");
      }
      onSuccess();
      closeSheet();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const hadFieldError = applyServerErrors(err.messages);
        if (!hadFieldError) {
          toast.error(err.message || "Failed to save person");
        }
      } else {
        toast.error("Failed to save person");
      }
    },
  });

  const isPending = mutation.isPending;

  return (
    <Sheet {...props}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-lg m-2 p-2">
        <SheetHeader className="text-left">
          <SheetTitle>
            {variant === "update" ? "Edit Person" : "Add Person"}
          </SheetTitle>
          <SheetDescription>
            {variant === "update"
              ? "Update the person details and save changes."
              : "Fill in the details to create a new person."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input id="lastName" {...form.register("lastName")} />
            {form.formState.errors.lastName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.lastName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input id="firstName" {...form.register("firstName")} />
            {form.formState.errors.firstName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.firstName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="middleName">Middle Name</Label>
            <Input id="middleName" {...form.register("middleName")} />
            {form.formState.errors.middleName && (
              <p className="text-sm text-destructive">
                {form.formState.errors.middleName.message}
              </p>
            )}
          </div>

          {/* Teams (optional) */}
          <div className="flex flex-col gap-2">
            <Label>Teams</Label>
            <Controller
              control={form.control}
              name="teamIds"
              render={({ field }) => (
                <RelationPicker
                  multi
                  variant="field"
                  value={field.value}
                  // RelationPicker emits `undefined` when the selection is
                  // cleared, not []. Without this normalisation the zod array
                  // schema breaks and "remove from every team" is lost.
                  onChange={(v) =>
                    field.onChange(
                      Array.isArray(v) ? v : v === undefined ? [] : [v],
                    )
                  }
                  queryOptionsFn={(filters: Record<string, unknown>) =>
                    teamsFilteredQueryOptions(filters)
                  }
                  columns={teamRelationColumns}
                  getLabel={(team: TeamDto) => team.name ?? String(team.id)}
                  getId={(team: TeamDto) => team.id}
                  placeholder="Select teams"
                />
              )}
            />
            {form.formState.errors.teamIds && (
              <p className="text-sm text-destructive">
                {form.formState.errors.teamIds.message}
              </p>
            )}
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
