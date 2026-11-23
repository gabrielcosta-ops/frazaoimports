import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/perfumes")({
  server: {
    handlers: {
      GET: async () => {
        const { listarPublico } = await import("@/server/catalog");
        return Response.json(await listarPublico());
      },
    },
  },
});
