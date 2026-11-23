import { NOME_COOKIE, lerCookie, tokenValido } from "./admin-auth";

export function json(dados: unknown, status = 200, cookie?: { valor: string; maxAge: number }) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (cookie) {
    headers.set(
      "set-cookie",
      `${NOME_COOKIE}=${encodeURIComponent(cookie.valor)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${cookie.maxAge}`,
    );
  }
  return new Response(JSON.stringify(dados), { status, headers });
}

export function exigirAdmin(request: Request): Response | null {
  if (!tokenValido(lerCookie(request, NOME_COOKIE))) {
    return json({ erro: "Entre de novo para continuar." }, 401);
  }
  return null;
}
