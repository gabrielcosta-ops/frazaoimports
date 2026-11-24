import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ehCategoria,
  normalizarWhatsapp,
  validarPerfume,
  type EntradaPerfume,
  type Perfume,
  type Vitrine,
} from "@/lib/perfume";

export class ErroCliente extends Error {}

type Linha = {
  id: string;
  nome: string;
  marca: string;
  notas: string;
  ml: number | string;
  preco: number | string;
  categoria: string;
  imagem_url: string | null;
  ativo: boolean;
  created_at: string;
};

const clientes = new Map<string, SupabaseClient>();

function limpar(valor: string | undefined): string {
  return (valor ?? "").trim().replace(/^["']|["']$/g, "");
}

function env(nome: string): string {
  return limpar(process.env[nome]);
}

function urlSupabase(): string {
  const endereco = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  if (!endereco) throw new ErroCliente("Defina SUPABASE_URL na Vercel.");
  return endereco.replace(/\/+$/, "");
}

function chavePublica(): string {
  const chave =
    env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
  if (!chave) throw new ErroCliente("Defina SUPABASE_PUBLISHABLE_KEY na Vercel.");
  return chave;
}

function chaveSecreta(): string {
  const chave = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!chave) throw new ErroCliente("Defina SUPABASE_SECRET_KEY na Vercel para gravar no banco.");
  return chave;
}

function cliente(privilegiado: boolean): SupabaseClient {
  const chave = privilegiado ? chaveSecreta() : chavePublica();
  const pronto = clientes.get(chave);
  if (pronto) return pronto;
  const criado = createClient(urlSupabase(), chave, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (chave.startsWith("sb_") && headers.get("Authorization") === `Bearer ${chave}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", chave);
        headers.set("user-agent", "frazaoimports");
        return fetch(input, { ...init, headers });
      },
    },
  });
  clientes.set(chave, criado);
  return criado;
}

function linhaParaPerfume(linha: Linha): Perfume {
  return {
    id: linha.id,
    nome: linha.nome,
    marca: linha.marca ?? "",
    notas: linha.notas ?? "",
    ml: Number(linha.ml),
    preco: Number(linha.preco),
    categoria: ehCategoria(linha.categoria) ? linha.categoria : "Unissex",
    imagem_url: linha.imagem_url,
    ativo: Boolean(linha.ativo),
    created_at: linha.created_at,
  };
}

async function buscar(privilegiado: boolean): Promise<Perfume[]> {
  let consulta = cliente(privilegiado).from("perfumes").select("*").order("created_at");
  if (!privilegiado) consulta = consulta.eq("ativo", true);
  const { data, error } = await consulta;
  if (error) throw new ErroCliente("Não foi possível ler o catálogo no Supabase.");
  return ((data ?? []) as Linha[]).map(linhaParaPerfume);
}

async function lerWhatsapp(): Promise<string> {
  const { data, error } = await cliente(false).from("loja").select("valor").eq("chave", "whatsapp").maybeSingle();
  if (error || !data || typeof data.valor !== "string") return "";
  return data.valor;
}

export async function listarPublico(): Promise<Vitrine> {
  const [perfumes, whatsapp] = await Promise.all([buscar(false), lerWhatsapp()]);
  return { whatsapp, perfumes };
}

export async function listarAdmin(): Promise<Vitrine> {
  const [perfumes, whatsapp] = await Promise.all([buscar(true), lerWhatsapp()]);
  return { whatsapp, perfumes };
}

export async function salvarPerfume(entrada: EntradaPerfume, id: string | null) {
  const atual = id ? (await buscar(true)).find((item) => item.id === id) ?? null : null;
  if (id && !atual) return { ok: false as const, status: 404, erro: "Perfume não encontrado." };
  const checado = validarPerfume(entrada, atual);
  if (!checado.ok) return { ok: false as const, status: 400, erro: checado.erro };
  const gravacao = cliente(true).from("perfumes");
  const { data, error } = atual
    ? await gravacao
        .update({
          nome: checado.perfume.nome,
          marca: checado.perfume.marca,
          notas: checado.perfume.notas,
          ml: checado.perfume.ml,
          preco: checado.perfume.preco,
          categoria: checado.perfume.categoria,
          imagem_url: checado.perfume.imagem_url,
          ativo: checado.perfume.ativo,
        })
        .eq("id", atual.id)
        .select("*")
        .single()
    : await gravacao
        .insert({
          nome: checado.perfume.nome,
          marca: checado.perfume.marca,
          notas: checado.perfume.notas,
          ml: checado.perfume.ml,
          preco: checado.perfume.preco,
          categoria: checado.perfume.categoria,
          imagem_url: checado.perfume.imagem_url,
          ativo: checado.perfume.ativo,
        })
        .select("*")
        .single();
  if (error || !data) throw new ErroCliente("O Supabase recusou a gravação. Confira a SUPABASE_SECRET_KEY.");
  if (atual?.imagem_url && atual.imagem_url !== checado.perfume.imagem_url) {
    await apagarFoto(atual.imagem_url);
  }
  return { ok: true as const, perfume: linhaParaPerfume(data as Linha) };
}

export async function excluirPerfume(id: string) {
  const atual = (await buscar(true)).find((item) => item.id === id);
  if (!atual) return { ok: false as const, status: 404, erro: "Perfume não encontrado." };
  const { error } = await cliente(true).from("perfumes").delete().eq("id", id);
  if (error) throw new ErroCliente("Não foi possível excluir o perfume.");
  await apagarFoto(atual.imagem_url);
  return { ok: true as const };
}

export async function salvarWhatsapp(
  valor: string,
): Promise<{ ok: true; whatsapp: string } | { ok: false; erro: string }> {
  const numero = normalizarWhatsapp(valor);
  if (!numero.ok) return numero;
  const { error } = await cliente(true)
    .from("loja")
    .upsert({ chave: "whatsapp", valor: numero.whatsapp }, { onConflict: "chave" });
  if (error) return { ok: false, erro: "Não foi possível salvar o WhatsApp." };
  return { ok: true, whatsapp: numero.whatsapp };
}

const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function guardarFoto(arquivo: File): Promise<string> {
  const extensao = TIPOS[arquivo.type];
  if (!extensao) throw new ErroCliente("Envie uma foto JPG, PNG ou WebP.");
  if (arquivo.size > 8 * 1024 * 1024) throw new ErroCliente("A foto precisa ter no máximo 8 MB.");
  const nome = `${crypto.randomUUID()}.${extensao}`;
  const { error } = await cliente(true)
    .storage.from("perfumes")
    .upload(nome, new Uint8Array(await arquivo.arrayBuffer()), { contentType: arquivo.type, upsert: false });
  if (error) throw new ErroCliente("Não foi possível enviar a foto. Crie o bucket perfumes no Supabase.");
  return cliente(true).storage.from("perfumes").getPublicUrl(nome).data.publicUrl;
}

function caminhoFoto(url: string | null): string | null {
  if (!url) return null;
  const marca = "/perfumes/";
  const indice = url.indexOf(marca);
  if (indice < 0) return null;
  const nome = decodeURIComponent(url.slice(indice + marca.length).split("?")[0] ?? "");
  if (!nome || nome.includes("..") || nome.includes("/")) return null;
  return nome;
}

async function apagarFoto(url: string | null): Promise<void> {
  const nome = caminhoFoto(url);
  if (!nome) return;
  await cliente(true).storage.from("perfumes").remove([nome]);
}
