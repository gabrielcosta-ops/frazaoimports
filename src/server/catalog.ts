import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizarWhatsapp,
  validarPerfume,
  type EntradaPerfume,
  type Perfume,
  type Vitrine,
} from "@/lib/perfume";

const ARQUIVO = path.join(process.cwd(), "data", "perfumes.json");
const PASTA_FOTOS = path.join(process.cwd(), "public", "uploads", "perfumes");

export class ErroCliente extends Error {}

type ArquivoCatalogo = {
  whatsapp: string;
  perfumes: Perfume[];
};

const SEMENTE: Perfume[] = [
  perfume("11111111-1111-4111-8111-111111111101", "Rose Éclat", "Maison Lune", "Rosa, peônia, almíscar", 100, 489, "Feminino", 1),
  perfume("11111111-1111-4111-8111-111111111102", "Velours Rose", "Atelier Doré", "Baunilha, framboesa, íris", 90, 559, "Feminino", 2),
  perfume("11111111-1111-4111-8111-111111111103", "Fleur de Nuit", "Maison Lune", "Jasmim, tuberosa, âmbar", 100, 619, "Feminino", 3),
  perfume("11111111-1111-4111-8111-111111111104", "Velvet Oak", "Noble House", "Carvalho, couro, cardamomo", 100, 529, "Masculino", 4),
  perfume("11111111-1111-4111-8111-111111111105", "Black Cedar", "Atelier Doré", "Cedro, vetiver, pimenta", 100, 479, "Masculino", 5),
  perfume("11111111-1111-4111-8111-111111111106", "Tabac Royal", "Noble House", "Tabaco, mel, fava tonka", 75, 649, "Masculino", 6),
  perfume("11111111-1111-4111-8111-111111111107", "Oud Majesty", "Dar Al Oud", "Oud, rosa, açafrão", 100, 399, "Árabes", 7),
  perfume("11111111-1111-4111-8111-111111111108", "Amber Sultan", "Al Sahra", "Âmbar, incenso, baunilha", 100, 349, "Árabes", 8),
  perfume("11111111-1111-4111-8111-111111111109", "Layali Gold", "Dar Al Oud", "Sândalo, oud, praliné", 80, 429, "Árabes", 9),
  perfume("11111111-1111-4111-8111-111111111110", "Lumière", "Studio Blanc", "Limão siciliano, neroli, chá", 100, 459, "Unissex", 10),
  perfume("11111111-1111-4111-8111-111111111111", "Sel Marin", "Studio Blanc", "Sal marinho, sálvia, musgo", 100, 499, "Unissex", 11),
  perfume("11111111-1111-4111-8111-111111111112", "Iris Poudre", "Atelier Doré", "Íris, almíscar branco, cedro", 50, 389, "Unissex", 12),
];

function perfume(
  id: string,
  nome: string,
  marca: string,
  notas: string,
  ml: number,
  preco: number,
  categoria: Perfume["categoria"],
  ordem: number,
): Perfume {
  return {
    id,
    nome,
    marca,
    notas,
    ml,
    preco,
    categoria,
    imagem_url: null,
    ativo: true,
    created_at: new Date(Date.UTC(2026, 0, 1, 12, 0, ordem)).toISOString(),
  };
}

let fila: Promise<unknown> = Promise.resolve();

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = fila.then(tarefa, tarefa);
  fila = proxima.then(
    () => undefined,
    () => undefined,
  );
  return proxima;
}

async function carregar(): Promise<ArquivoCatalogo> {
  try {
    const texto = await readFile(ARQUIVO, "utf8");
    const dados = JSON.parse(texto) as ArquivoCatalogo;
    if (!dados || !Array.isArray(dados.perfumes)) throw new ErroCliente("Catálogo inválido.");
    return {
      whatsapp: typeof dados.whatsapp === "string" ? dados.whatsapp : "",
      perfumes: dados.perfumes,
    };
  } catch (erro) {
    const codigo = erro && typeof erro === "object" && "code" in erro ? erro.code : undefined;
    if (codigo === "ENOENT") {
      const vazio = { whatsapp: "", perfumes: SEMENTE };
      await gravar(vazio);
      return vazio;
    }
    if (erro instanceof ErroCliente) throw erro;
    throw new ErroCliente("Não foi possível ler o catálogo.");
  }
}

async function gravar(dados: ArquivoCatalogo): Promise<void> {
  await mkdir(path.dirname(ARQUIVO), { recursive: true });
  await writeFile(ARQUIVO, JSON.stringify(dados, null, 2), "utf8");
}

function caminhoFoto(url: string): string | null {
  if (!url.startsWith("/uploads/perfumes/") || url.includes("..")) return null;
  const nome = path.basename(url);
  if (!/^[\w.-]+$/.test(nome)) return null;
  const alvo = path.join(PASTA_FOTOS, nome);
  if (!alvo.startsWith(PASTA_FOTOS)) return null;
  return alvo;
}

async function apagarFoto(url: string | null): Promise<void> {
  if (!url) return;
  const alvo = caminhoFoto(url);
  if (!alvo) return;
  await rm(alvo, { force: true });
}

export function listarPublico(): Promise<Vitrine> {
  return emFila(async () => {
    const dados = await carregar();
    return { whatsapp: dados.whatsapp, perfumes: dados.perfumes.filter((item) => item.ativo) };
  });
}

export function listarAdmin(): Promise<Vitrine> {
  return emFila(async () => {
    const dados = await carregar();
    return { whatsapp: dados.whatsapp, perfumes: dados.perfumes };
  });
}

export function salvarPerfume(entrada: EntradaPerfume, id: string | null) {
  return emFila(async () => {
    const dados = await carregar();
    const atual = id ? (dados.perfumes.find((item) => item.id === id) ?? null) : null;
    if (id && !atual) return { ok: false as const, status: 404, erro: "Perfume não encontrado." };
    const checado = validarPerfume(entrada, atual);
    if (!checado.ok) return { ok: false as const, status: 400, erro: checado.erro };
    if (atual?.imagem_url && atual.imagem_url !== checado.perfume.imagem_url) {
      await apagarFoto(atual.imagem_url);
    }
    dados.perfumes = atual
      ? dados.perfumes.map((item) => (item.id === atual.id ? checado.perfume : item))
      : [...dados.perfumes, checado.perfume];
    await gravar(dados);
    return { ok: true as const, perfume: checado.perfume };
  });
}

export function excluirPerfume(id: string) {
  return emFila(async () => {
    const dados = await carregar();
    const atual = dados.perfumes.find((item) => item.id === id);
    if (!atual) return { ok: false as const, status: 404, erro: "Perfume não encontrado." };
    dados.perfumes = dados.perfumes.filter((item) => item.id !== id);
    await gravar(dados);
    await apagarFoto(atual.imagem_url);
    return { ok: true as const };
  });
}

export function salvarWhatsapp(valor: string) {
  return emFila(async () => {
    const numero = normalizarWhatsapp(valor);
    if (!numero.ok) return numero;
    const dados = await carregar();
    dados.whatsapp = numero.whatsapp;
    await gravar(dados);
    return { ok: true as const, whatsapp: numero.whatsapp };
  });
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
  await mkdir(PASTA_FOTOS, { recursive: true });
  const nome = `${crypto.randomUUID()}.${extensao}`;
  await writeFile(path.join(PASTA_FOTOS, nome), new Uint8Array(await arquivo.arrayBuffer()));
  return `/uploads/perfumes/${nome}`;
}
