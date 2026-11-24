import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const NOME_COOKIE = "if_admin";
const DURACAO_MS = 1000 * 60 * 60 * 24 * 14;

function lerEnvArquivo(nome: string): string | undefined {
  try {
    const texto = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const linha of texto.split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith("#")) continue;
      const igual = limpa.indexOf("=");
      if (igual < 0) continue;
      if (limpa.slice(0, igual).trim() !== nome) continue;
      return limpa
        .slice(igual + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function env(nome: string, padrao: string): string {
  const bruto = process.env[nome] || lerEnvArquivo(nome) || padrao;
  return bruto.trim().replace(/^["']|["']$/g, "");
}

function segredo(): string {
  return env("ADMIN_SECRET", "import-frazao-admin-local");
}

export function senhaEsperada(): string {
  return env("ADMIN_PASSWORD", "frazao123");
}

function mac(valor: string): Buffer {
  return createHmac("sha256", segredo()).update(valor).digest();
}

export function senhaConfere(informada: string): boolean {
  const a = mac(informada);
  const b = mac(senhaEsperada());
  return timingSafeEqual(a, b);
}

export function criarToken(): string {
  const expira = String(Date.now() + DURACAO_MS);
  const assinatura = createHmac("sha256", segredo()).update(expira).digest("base64url");
  return `${expira}.${assinatura}`;
}

export function tokenValido(token: string | undefined): boolean {
  if (!token) return false;
  const ponto = token.lastIndexOf(".");
  if (ponto <= 0) return false;
  const corpo = token.slice(0, ponto);
  const assinatura = token.slice(ponto + 1);
  const expira = Number(corpo);
  if (!Number.isFinite(expira) || expira < Date.now()) return false;
  const esperada = createHmac("sha256", segredo()).update(corpo).digest("base64url");
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function lerCookie(request: Request, nome: string): string | undefined {
  const bruto = request.headers.get("cookie");
  if (!bruto) return undefined;
  for (const parte of bruto.split(";")) {
    const igual = parte.indexOf("=");
    if (igual < 0) continue;
    const chave = parte.slice(0, igual).trim();
    if (chave !== nome) continue;
    return decodeURIComponent(parte.slice(igual + 1).trim());
  }
  return undefined;
}

let falhas = 0;
let bloqueadoAte = 0;

export function registrarFalhaLogin(): number {
  falhas += 1;
  if (falhas >= 8) {
    bloqueadoAte = Date.now() + 60_000;
    falhas = 0;
  }
  return Math.max(0, bloqueadoAte - Date.now());
}

export function loginBloqueado(): number {
  return Math.max(0, bloqueadoAte - Date.now());
}

export function registrarLoginOk(): void {
  falhas = 0;
  bloqueadoAte = 0;
}
