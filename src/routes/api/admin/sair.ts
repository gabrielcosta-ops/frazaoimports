import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/sair")({
  server: {
    handlers: {
      POST: async () => {
        const { json } = await import("@/server/http");
        return json({ ok: true }, 200, { valor: "", maxAge: 0 });
      },
    },
  },
});
