import { describe, expect, it } from "vitest";
import { criarToken, senhaConfere, tokenValido } from "@/server/admin-auth";

describe("admin auth", () => {
  it("aceita a senha padrão e um token novo", () => {
    expect(senhaConfere("frazao123")).toBe(true);
    expect(senhaConfere("outra-senha")).toBe(false);
    expect(tokenValido(criarToken())).toBe(true);
  });

  it("rejeita token adulterado", () => {
    const token = criarToken();
    expect(tokenValido(`${token.slice(0, -2)}aa`)).toBe(false);
    expect(tokenValido(undefined)).toBe(false);
  });
});
