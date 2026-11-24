import { createFileRoute } from "@tanstack/react-router";
import type { EntradaPerfume } from "@/lib/perfume";

export const Route = createFileRoute("/api/admin/perfumes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { exigirAdmin, json } = await import("@/server/http");
        const negado = exigirAdmin(request);
        if (negado) return negado;
        const { ErroCliente, listarAdmin } = await import("@/server/catalog");
        try {
          return json(await listarAdmin());
        } catch (erro) {
          const mensagem = erro instanceof ErroCliente ? erro.message : "Não foi possível ler o catálogo.";
          return json({ erro: mensagem }, 500);
        }
      },
      POST: async ({ request }) => {
        const { exigirAdmin, json } = await import("@/server/http");
        const negado = exigirAdmin(request);
        if (negado) return negado;
        const entrada = await lerEntrada(request);
        if (entrada instanceof Response) return entrada;
        const { ErroCliente, salvarPerfume } = await import("@/server/catalog");
        try {
          const resultado = await salvarPerfume(entrada, null);
          if (!resultado.ok) return json({ erro: resultado.erro }, resultado.status);
          return json({ perfume: resultado.perfume }, 201);
        } catch (erro) {
          const mensagem = erro instanceof ErroCliente ? erro.message : "Não foi possível salvar.";
          return json({ erro: mensagem }, 500);
        }
      },
    },
  },
});

async function lerEntrada(request: Request): Promise<EntradaPerfume | Response> {
  const { json } = await import("@/server/http");
  try {
    const corpo = (await request.json()) as Partial<EntradaPerfume>;
    return {
      nome: typeof corpo.nome === "string" ? corpo.nome : "",
      marca: typeof corpo.marca === "string" ? corpo.marca : "",
      notas: typeof corpo.notas === "string" ? corpo.notas : "",
      ml: Number(corpo.ml),
      preco: Number(corpo.preco),
      categoria: typeof corpo.categoria === "string" ? corpo.categoria : "",
      imagem_url: typeof corpo.imagem_url === "string" ? corpo.imagem_url : null,
      ativo: corpo.ativo !== false,
    };
  } catch {
    return json({ erro: "Dados inválidos." }, 400);
  }
}
