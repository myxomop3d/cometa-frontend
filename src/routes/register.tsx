// Регистрация: форма создания учётной записи + person (+ связь с командой).
import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, ArrowLeft, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TeamCombobox } from "@/features/team/components/team-combobox";
import {
  registerFormSchema,
  registerFormToRequest,
  EMAIL_RE,
  type RegisterFormValues,
} from "@/features/register/schema";
import { namesToFill, registerErrorFields } from "@/features/register/helpers";
import { register as registerAccount, checkSigmaLogin, personByEmail } from "@/api/auth";
import { ApiError } from "@/lib/api/create-crud-api";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      sigmaLogin: "",
      email: "",
      lastName: "",
      firstName: "",
      middleName: "",
      password: "",
      passwordConfirm: "",
      teamId: null,
    },
  });

  const sigmaReg = register("sigmaLogin");
  const emailReg = register("email");

  async function onSigmaBlur(value: string) {
    if (!/^\d{8}$/.test(value)) return;
    try {
      const { exists } = await checkSigmaLogin(value);
      if (exists) {
        setError("sigmaLogin", { message: "Already exists, please login" });
      } else {
        clearErrors("sigmaLogin");
      }
    } catch {
      // network/lookup failure is non-blocking; submit still re-validates server-side
    }
  }

  async function onEmailBlur(value: string) {
    if (!EMAIL_RE.test(value)) return;
    try {
      const { person, hasAccount } = await personByEmail(value);
      if (hasAccount) {
        setError("email", { message: "This person already has an account, please login" });
        return;
      }
      clearErrors("email");
      if (person) {
        const fills = namesToFill(
          {
            lastName: getValues("lastName"),
            firstName: getValues("firstName"),
            middleName: getValues("middleName"),
          },
          person,
        );
        for (const [field, val] of Object.entries(fills)) {
          setValue(field as keyof RegisterFormValues, val, { shouldValidate: true });
        }
      }
    } catch {
      // non-blocking
    }
  }

  const onSubmit = async (data: RegisterFormValues) => {
    clearErrors("root");
    try {
      await registerAccount(registerFormToRequest(data));
      toast.success("Account created — please sign in");
      navigate({ to: "/login" });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.messages.length > 0) {
        for (const { field, message } of registerErrorFields(err.messages)) {
          setError(field, { message });
        }
      } else {
        console.error(err);
        setError("root", {
          message: "Registration failed. Please try again.",
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Register a new Cometa account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Sigma login" htmlFor="sigmaLogin" error={errors.sigmaLogin?.message}>
              <Input
                id="sigmaLogin"
                placeholder="12345678"
                {...sigmaReg}
                onBlur={(e) => {
                  sigmaReg.onBlur(e);
                  void onSigmaBlur(e.target.value);
                }}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                {...emailReg}
                onBlur={(e) => {
                  emailReg.onBlur(e);
                  void onEmailBlur(e.target.value);
                }}
              />
            </Field>

            <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" {...register("lastName")} />
            </Field>

            <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
              <Input id="firstName" {...register("firstName")} />
            </Field>

            <Field label="Middle name" htmlFor="middleName" error={errors.middleName?.message}>
              <Input id="middleName" {...register("middleName")} />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            </Field>

            <Field
              label="Password confirmation"
              htmlFor="passwordConfirm"
              error={errors.passwordConfirm?.message}
            >
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                {...register("passwordConfirm")}
              />
            </Field>

            <div className="space-y-2">
              <Label>Team</Label>
              <Controller
                control={control}
                name="teamId"
                render={({ field }) => (
                  <TeamCombobox value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            {errors.root && (
              <p className="text-sm text-destructive text-center">{errors.root.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="mr-2 size-4" />
              )}
              {isSubmitting ? "Creating…" : "Register"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/login" })}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 size-4" />
              Return
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
