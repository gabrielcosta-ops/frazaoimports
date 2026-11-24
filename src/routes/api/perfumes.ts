import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/perfumes")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listarPublico } = await import("@/server/catalog");
          return Response.json(await listarPublico());
        } catch (erro) {
          const mensagem = erro instanceof Error ? erro.message : "Não foi possível ler o catálogo.";
          return Response.json({ erro: mensagem }, { status: 500 });
        }
      },
    },
  },
});
