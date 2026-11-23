import { createFileRoute } from "@tanstack/react-router";
import type { EntradaPerfume } from "@/lib/perfume";

export const Route = createFileRoute("/api/admin/perfumes/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const { exigirAdmin, json } = await import("@/server/http");
        const negado = exigirAdmin(request);
        if (negado) return negado;
        let corpo: Partial<EntradaPerfume>;
        try {
          corpo = (await request.json()) as Partial<EntradaPerfume>;
        } catch {
          return json({ erro: "Dados inválidos." }, 400);
        }
        const entrada: EntradaPerfume = {
          nome: typeof corpo.nome === "string" ? corpo.nome : "",
          marca: typeof corpo.marca === "string" ? corpo.marca : "",
          notas: typeof corpo.notas === "string" ? corpo.notas : "",
          ml: Number(corpo.ml),
          preco: Number(corpo.preco),
          categoria: typeof corpo.categoria === "string" ? corpo.categoria : "",
          imagem_url: typeof corpo.imagem_url === "string" ? corpo.imagem_url : null,
          ativo: corpo.ativo !== false,
        };
        const { salvarPerfume } = await import("@/server/catalog");
        const resultado = await salvarPerfume(entrada, params.id);
        if (!resultado.ok) return json({ erro: resultado.erro }, resultado.status);
        return json({ perfume: resultado.perfume });
      },
      DELETE: async ({ request, params }) => {
        const { exigirAdmin, json } = await import("@/server/http");
        const negado = exigirAdmin(request);
        if (negado) return negado;
        const { excluirPerfume } = await import("@/server/catalog");
        const resultado = await excluirPerfume(params.id);
        if (!resultado.ok) return json({ erro: resultado.erro }, resultado.status);
        return json({ ok: true });
      },
    },
  },
});
