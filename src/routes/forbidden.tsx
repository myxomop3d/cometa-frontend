// Страница "Доступ запрещён" (403) — отображается, когда у пользователя нет прав на ресурс
import { createFileRoute } from "@tanstack/react-router";
import { ShieldOff, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forbidden")({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  const goToHome = () => {
    window.location.href = "/automated-system";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <ShieldOff className="size-16 text-destructive" />
        <h1 className="text-3xl font-bold">403</h1>
        <p className="text-muted-foreground">
          У вас недостаточно прав для просмотра этой страницы. Обратитесь к администратору.
        </p>
        <Button variant="outline" onClick={goToHome}>
          <Home className="mr-2 size-4" />
          На главную
        </Button>
      </div>
    </div>
  );
}
