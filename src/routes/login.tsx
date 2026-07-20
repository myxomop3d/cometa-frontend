// Страница входа: форма sigmaLogin + password, валидация, вызов AuthContext.login()
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/create-crud-api";
import { LogIn, KeyRound } from "lucide-react";

const loginSchema = z.object({
  sigmaLogin: z.string().min(8, "SIGMA login is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, handleCertLogin } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError && (err.status === 401 || err.status === 403)
          ? "Invalid login or password."
          : err instanceof Error
            ? err.message
            : "Login failed. Check your credentials.";
      setError("root", { message });
    }
  };

  const onCertLogin = async () => {
    try {
      await handleCertLogin();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Certificate login failed. Make sure the client certificate is installed in your browser.";
      setError("root", { message });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Cometa</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="sigmaLogin" className="text-sm font-medium">
                SIGMA login
              </label>
              <Input
                id="sigmaLogin"
                type="text"
                placeholder="12345678"
                autoComplete="username"
                {...register("sigmaLogin")}
              />
              {errors.sigmaLogin && (
                <p className="text-sm text-destructive">{errors.sigmaLogin.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {errors.root && (
              <p className="text-sm text-destructive text-center">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn className="mr-2 size-4" />
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onCertLogin}
              disabled={isSubmitting}
            >
              <KeyRound className="mr-2 size-4" />
              Sign in by certificate
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
