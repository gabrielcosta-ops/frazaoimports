import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/foto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { exigirAdmin, json } = await import("@/server/http");
        const negado = exigirAdmin(request);
        if (negado) return negado;
        let foto: FormDataEntryValue | null = null;
        try {
          const form = await request.formData();
          foto = form.get("foto");
        } catch {
          return json({ erro: "Envie a foto do perfume." }, 400);
        }
        if (!(foto instanceof File) || foto.size === 0) {
          return json({ erro: "Escolha uma foto." }, 400);
        }
        const { ErroCliente, guardarFoto } = await import("@/server/catalog");
        try {
          const url = await guardarFoto(foto);
          return json({ url });
        } catch (erro) {
          const mensagem = erro instanceof ErroCliente ? erro.message : "Falha ao enviar a foto.";
          return json({ erro: mensagem }, 400);
        }
      },
    },
  },
});
