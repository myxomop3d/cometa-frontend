import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { parseCertCallbackHash } from "@/lib/auth/cert-callback";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/cert/callback")({
  component: CertCallbackPage,
});

function CertCallbackPage() {
  const { completeCertLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false); // guard React StrictMode double-invoke

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const result = parseCertCallbackHash(window.location.hash);
    // Strip the token/error from the URL immediately (history + reload safety).
    window.history.replaceState(null, "", window.location.pathname);

    if ("token" in result) {
      completeCertLogin(result.token).catch(() =>
        setError("Certificate sign-in failed. Please try again."),
      );
    } else {
      setError(
        result.error === "cert_invalid"
          ? "Certificate sign-in failed. Make sure your client certificate is installed in your browser."
          : "Certificate sign-in failed. Please try again.",
      );
    }
  }, [completeCertLogin]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      {error ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={() => navigate({ to: "/login" })}>Back to login</Button>
        </div>
      ) : (
        <p className="text-muted-foreground">Completing certificate sign-in…</p>
      )}
    </div>
  );
}
