import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/loja")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { exigirAdmin, json } = await import("@/server/http");
        const negado = exigirAdmin(request);
        if (negado) return negado;
        let whatsapp = "";
        try {
          const corpo = (await request.json()) as { whatsapp?: unknown };
          whatsapp = typeof corpo.whatsapp === "string" ? corpo.whatsapp : "";
        } catch {
          return json({ erro: "Dados inválidos." }, 400);
        }
        const { salvarWhatsapp } = await import("@/server/catalog");
        const resultado = await salvarWhatsapp(whatsapp);
        if (!resultado.ok) return json({ erro: resultado.erro }, 400);
        return json({ whatsapp: resultado.whatsapp });
      },
    },
  },
});
