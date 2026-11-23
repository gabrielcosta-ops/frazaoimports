import { describe, expect, it } from "vitest";
import { linkWhatsapp, normalizarWhatsapp, validarPerfume } from "@/lib/perfume";

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
});
