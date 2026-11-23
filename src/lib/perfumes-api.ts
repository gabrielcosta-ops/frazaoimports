import type { EntradaPerfume, Perfume, Vitrine } from "@/lib/perfume";

async function ler<T>(resposta: Response): Promise<T> {
  const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível concluir a ação.");
  return dados as T;
}

export function listarVitrine(): Promise<Vitrine> {
  return fetch("/api/perfumes").then((resposta) => ler<Vitrine>(resposta));
}

export function verSessao(): Promise<{ autenticado: boolean }> {
  return fetch("/api/admin/sessao").then((resposta) => ler(resposta));
}

export function entrarAdmin(senha: string): Promise<{ ok: true }> {
  return fetch("/api/admin/entrar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ senha }),
  }).then((resposta) => ler(resposta));
}

export function sairAdmin(): Promise<{ ok: true }> {
  return fetch("/api/admin/sair", { method: "POST" }).then((resposta) => ler(resposta));
}

export function listarAdmin(): Promise<Vitrine> {
  return fetch("/api/admin/perfumes").then((resposta) => ler<Vitrine>(resposta));
}

export function criarPerfume(entrada: EntradaPerfume): Promise<{ perfume: Perfume }> {
  return fetch("/api/admin/perfumes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entrada),
  }).then((resposta) => ler(resposta));
}

export function atualizarPerfume(
  id: string,
  entrada: EntradaPerfume,
): Promise<{ perfume: Perfume }> {
  return fetch(`/api/admin/perfumes/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entrada),
  }).then((resposta) => ler(resposta));
}

export function excluirPerfume(id: string): Promise<{ ok: true }> {
  return fetch(`/api/admin/perfumes/${id}`, { method: "DELETE" }).then((resposta) => ler(resposta));
}

export function salvarWhatsapp(whatsapp: string): Promise<{ whatsapp: string }> {
  return fetch("/api/admin/loja", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ whatsapp }),
  }).then((resposta) => ler(resposta));
}

export async function enviarFoto(arquivo: File): Promise<string> {
  const corpo = new FormData();
  corpo.set("foto", arquivo);
  const dados = await fetch("/api/admin/foto", { method: "POST", body: corpo }).then((resposta) =>
    ler<{ url: string }>(resposta),
  );
  return dados.url;
}
