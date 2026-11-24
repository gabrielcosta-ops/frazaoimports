import { describe, expect, it } from "vitest";
import { linkCompra, linkWhatsapp, mensagemCompra, normalizarWhatsapp, validarPerfume } from "@/lib/perfume";

const base = {
  nome: "Oud Majesty",
  marca: "Dar Al Oud",
  notas: "Oud, rosa",
  ml: 100,
  preco: 399,
  categoria: "Árabes",
  imagem_url: null,
  ativo: true,
};

describe("perfume", () => {
  it("aceita um cadastro completo", () => {
    const resultado = validarPerfume(base, null);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.perfume.nome).toBe("Oud Majesty");
  });

  it("recusa foto que não veio do upload", () => {
    const resultado = validarPerfume({ ...base, imagem_url: "https://exemplo.com/foto.jpg" }, null);
    expect(resultado.ok).toBe(false);
  });

  it("aceita foto no storage do supabase", () => {
    const resultado = validarPerfume(
      {
        ...base,
        imagem_url:
          "https://wpmankwlsjviplzgkpon.supabase.co/storage/v1/object/public/perfumes/frasco.webp",
      },
      null,
    );
    expect(resultado.ok).toBe(true);
  });

  it("aceita foto salva no admin", () => {
    const resultado = validarPerfume(
      { ...base, imagem_url: "/uploads/perfumes/frasco.webp" },
      { id: "abc", created_at: "2026-01-01T00:00:00.000Z" },
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.perfume.id).toBe("abc");
  });

  it("normaliza o WhatsApp e monta o link", () => {
    expect(normalizarWhatsapp("(11) 98888-7777")).toEqual({ ok: true, whatsapp: "11988887777" });
    expect(linkWhatsapp("11988887777", "Rose")).toContain("wa.me/5511988887777");
  });

  it("monta o pedido com as especificações do perfume", () => {
    const texto = mensagemCompra(base, 2);
    expect(texto).toContain("Perfume: Oud Majesty");
    expect(texto).toContain("Marca: Dar Al Oud");
    expect(texto).toContain("Categoria: Árabes");
    expect(texto).toContain("Volume: 100 ml");
    expect(texto).toContain("Notas: Oud, rosa");
    expect(texto).toContain("Quantidade: 2");
    const link = linkCompra("11988887777", base, 2);
    expect(link).toContain("wa.me/5511988887777");
    expect(link).toContain(encodeURIComponent("Oud Majesty"));
  });
});
