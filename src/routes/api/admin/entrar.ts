import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/entrar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json } = await import("@/server/http");
        const auth = await import("@/server/admin-auth");
        const espera = auth.loginBloqueado();
        if (espera > 0) {
          return json({ erro: "Muitas tentativas. Espere um minuto e tente de novo." }, 429);
        }
        let senha = "";
        try {
          const corpo = (await request.json()) as { senha?: unknown };
          senha = typeof corpo.senha === "string" ? corpo.senha : "";
        } catch {
          return json({ erro: "Dados inválidos." }, 400);
        }
        if (!auth.senhaConfere(senha)) {
          auth.registrarFalhaLogin();
          return json({ erro: "Senha incorreta." }, 401);
        }
        auth.registrarLoginOk();
        return json({ ok: true }, 200, { valor: auth.criarToken(), maxAge: 60 * 60 * 24 * 14 });
      },
    },
  },
});
