import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/sessao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { NOME_COOKIE, lerCookie, tokenValido } = await import("@/server/admin-auth");
        return Response.json({ autenticado: tokenValido(lerCookie(request, NOME_COOKIE)) });
      },
    },
  },
});
