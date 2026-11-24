export const CATEGORIAS = ["Feminino", "Masculino", "Árabes", "Unissex"] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type Perfume = {
  id: string;
  nome: string;
  marca: string;
  notas: string;
  ml: number;
  preco: number;
  categoria: Categoria;
  imagem_url: string | null;
  ativo: boolean;
  created_at: string;
};

export type EntradaPerfume = {
  nome: string;
  marca: string;
  notas: string;
  ml: number;
  preco: number;
  categoria: string;
  imagem_url: string | null;
  ativo: boolean;
};

export type Vitrine = {
  whatsapp: string;
  perfumes: Perfume[];
};

export function ehCategoria(valor: string): valor is Categoria {
  return (CATEGORIAS as readonly string[]).includes(valor);
}

export function validarPerfume(
  entrada: EntradaPerfume,
  atual: { id: string; created_at: string } | null,
): { ok: true; perfume: Perfume } | { ok: false; erro: string } {
  const nome = entrada.nome.trim();
  if (!nome) return { ok: false, erro: "Informe o nome do perfume." };
  if (nome.length > 80) return { ok: false, erro: "O nome pode ter no máximo 80 caracteres." };

  const marca = entrada.marca.trim();
  const notas = entrada.notas.trim();
  if (marca.length > 80) return { ok: false, erro: "A marca pode ter no máximo 80 caracteres." };
  if (notas.length > 240) return { ok: false, erro: "As notas podem ter no máximo 240 caracteres." };

  if (!Number.isFinite(entrada.ml) || entrada.ml < 1 || entrada.ml > 1000) {
    return { ok: false, erro: "O tamanho precisa estar entre 1 e 1000 ml." };
  }
  if (!Number.isFinite(entrada.preco) || entrada.preco < 0 || entrada.preco > 999999) {
    return { ok: false, erro: "Informe um preço válido." };
  }
  if (!ehCategoria(entrada.categoria)) return { ok: false, erro: "Escolha uma categoria." };

  let imagem: string | null = null;
  if (entrada.imagem_url) {
    const url = entrada.imagem_url.trim();
    const local = url.startsWith("/uploads/perfumes/") && !url.includes("..") && !url.includes("\\");
    const storage = /^https:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\/perfumes\//.test(url);
    if (!local && !storage) {
      return { ok: false, erro: "A foto precisa ser enviada pelo admin." };
    }
    imagem = url;
  }

  return {
    ok: true,
    perfume: {
      id: atual?.id ?? crypto.randomUUID(),
      created_at: atual?.created_at ?? new Date().toISOString(),
      nome,
      marca,
      notas,
      ml: Math.round(entrada.ml),
      preco: Math.round(entrada.preco * 100) / 100,
      categoria: entrada.categoria,
      imagem_url: imagem,
      ativo: Boolean(entrada.ativo),
    },
  };
}

export function normalizarWhatsapp(
  valor: string,
): { ok: true; whatsapp: string } | { ok: false; erro: string } {
  const digitos = valor.replace(/\D/g, "");
  if (!digitos) return { ok: true, whatsapp: "" };
  if (digitos.length < 10 || digitos.length > 13) {
    return { ok: false, erro: "Informe o WhatsApp com DDD. Ex.: 11999999999" };
  }
  return { ok: true, whatsapp: digitos };
}

export function linkWhatsapp(numero: string, nome: string): string | null {
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return null;
  const fone = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const texto = `Olá! Vi o perfume ${nome} na vitrine Import Frazão e quero saber mais.`;
  return `https://wa.me/${fone}?text=${encodeURIComponent(texto)}`;
}
