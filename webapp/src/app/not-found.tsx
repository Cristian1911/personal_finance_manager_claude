import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-xl font-semibold">Página no encontrada</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        La página que buscas no existe o fue movida.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    </div>
  );
}
