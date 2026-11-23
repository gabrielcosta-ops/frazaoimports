import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from urllib.parse import quote

from flask import (
    Flask,
    abort,
    flash,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.middleware.proxy_fix import ProxyFix

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("FRAZAO_DB") or os.path.join(BASE, "data", "catalogo.db")
UPLOADS = os.environ.get("FRAZAO_UPLOADS") or os.path.join(BASE, "uploads", "perfumes")
JSON_CATALOGO = os.path.join(BASE, "data", "perfumes.json")

CATEGORIAS = [
    {"nome": "Feminino", "descricao": "Florais, doces e envolventes", "imagem": "img/cat-feminino.jpg"},
    {"nome": "Masculino", "descricao": "Amadeirados e marcantes", "imagem": "img/cat-masculino.jpg"},
    {"nome": "Árabes", "descricao": "Oud, âmbar e intensidade", "imagem": "img/cat-arabe.jpg"},
    {"nome": "Unissex", "descricao": "Frescos e elegantes", "imagem": "img/cat-unissex.jpg"},
]
NOMES_CATEGORIA = {item["nome"] for item in CATEGORIAS}

SEMENTE = [
    ("11111111-1111-4111-8111-111111111101", "Rose Éclat", "Maison Lune", "Rosa, peônia, almíscar", 100, 489, "Feminino", 1),
    ("11111111-1111-4111-8111-111111111102", "Velours Rose", "Atelier Doré", "Baunilha, framboesa, íris", 90, 559, "Feminino", 2),
    ("11111111-1111-4111-8111-111111111103", "Fleur de Nuit", "Maison Lune", "Jasmim, tuberosa, âmbar", 100, 619, "Feminino", 3),
    ("11111111-1111-4111-8111-111111111104", "Velvet Oak", "Noble House", "Carvalho, couro, cardamomo", 100, 529, "Masculino", 4),
    ("11111111-1111-4111-8111-111111111105", "Black Cedar", "Atelier Doré", "Cedro, vetiver, pimenta", 100, 479, "Masculino", 5),
    ("11111111-1111-4111-8111-111111111106", "Tabac Royal", "Noble House", "Tabaco, mel, fava tonka", 75, 649, "Masculino", 6),
    ("11111111-1111-4111-8111-111111111107", "Oud Majesty", "Dar Al Oud", "Oud, rosa, açafrão", 100, 399, "Árabes", 7),
    ("11111111-1111-4111-8111-111111111108", "Amber Sultan", "Al Sahra", "Âmbar, incenso, baunilha", 100, 349, "Árabes", 8),
    ("11111111-1111-4111-8111-111111111109", "Layali Gold", "Dar Al Oud", "Sândalo, oud, praliné", 80, 429, "Árabes", 9),
    ("11111111-1111-4111-8111-111111111110", "Lumière", "Studio Blanc", "Limão siciliano, neroli, chá", 100, 459, "Unissex", 10),
    ("11111111-1111-4111-8111-111111111111", "Sel Marin", "Studio Blanc", "Sal marinho, sálvia, musgo", 100, 499, "Unissex", 11),
    ("11111111-1111-4111-8111-111111111112", "Iris Poudre", "Atelier Doré", "Íris, almíscar branco, cedro", 50, 389, "Unissex", 12),
]


def ler_env_arquivo(nome: str) -> str | None:
    caminho = os.path.join(BASE, ".env")
    try:
        with open(caminho, encoding="utf-8") as arquivo:
            for linha in arquivo:
                limpa = linha.strip()
                if not limpa or limpa.startswith("#") or "=" not in limpa:
                    continue
                chave, valor = limpa.split("=", 1)
                if chave.strip() != nome:
                    continue
                return valor.strip().strip('"').strip("'")
    except OSError:
        return None
    return None


def env(nome: str, padrao: str) -> str:
    return os.environ.get(nome) or ler_env_arquivo(nome) or padrao


def criar_app() -> Flask:
    aplicacao = Flask(__name__)
    aplicacao.secret_key = env("SECRET_KEY", env("ADMIN_SECRET", "import-frazao-troque-esta-chave"))
    aplicacao.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
    aplicacao.config["SESSION_COOKIE_HTTPONLY"] = True
    aplicacao.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    aplicacao.wsgi_app = ProxyFix(aplicacao.wsgi_app, x_for=1, x_proto=1, x_host=1)
    return aplicacao


app = criar_app()


def senha_esperada() -> str:
    return env("ADMIN_PASSWORD", "frazao123")


def admin_logado() -> bool:
    return bool(session.get("admin"))


def exigir_admin():
    if not admin_logado():
        flash("Entre para continuar.", "erro")
        return redirect(url_for("admin"))
    return None


def csrf_token() -> str:
    token = session.get("_csrf")
    if not isinstance(token, str) or not token:
        token = secrets.token_urlsafe(32)
        session["_csrf"] = token
    return token


def validar_csrf() -> bool:
    enviado = request.form.get("csrf", "")
    esperado = session.get("_csrf", "")
    if not isinstance(esperado, str) or not esperado or not enviado:
        return False
    return hmac.compare_digest(enviado, esperado)


def conectar() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    conn = sqlite3.connect(DB, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def banco():
    conn = conectar()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def instante(ordem: int) -> str:
    return datetime(2026, 1, 1, 12, 0, ordem, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def semente() -> dict:
    if os.path.exists(JSON_CATALOGO):
        try:
            with open(JSON_CATALOGO, encoding="utf-8") as arquivo:
                dados = json.load(arquivo)
            if isinstance(dados, dict) and isinstance(dados.get("perfumes"), list) and dados["perfumes"]:
                return dados
        except (OSError, json.JSONDecodeError):
            pass
    perfumes = []
    for item in SEMENTE:
        perfumes.append(
            {
                "id": item[0],
                "nome": item[1],
                "marca": item[2],
                "notas": item[3],
                "ml": item[4],
                "preco": item[5],
                "categoria": item[6],
                "imagem_url": None,
                "ativo": True,
                "created_at": instante(item[7]),
            }
        )
    return {"whatsapp": "", "perfumes": perfumes}


def init_db() -> None:
    os.makedirs(UPLOADS, exist_ok=True)
    with banco() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS perfumes (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                marca TEXT NOT NULL DEFAULT '',
                notas TEXT NOT NULL DEFAULT '',
                ml INTEGER NOT NULL DEFAULT 100,
                preco REAL NOT NULL DEFAULT 0,
                categoria TEXT NOT NULL DEFAULT 'Unissex',
                imagem_url TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS loja (
                chave TEXT PRIMARY KEY,
                valor TEXT NOT NULL
            )
            """
        )
        total = conn.execute("SELECT COUNT(*) AS n FROM perfumes").fetchone()["n"]
        if total:
            return
        dados = semente()
        for perfume in dados["perfumes"]:
            conn.execute(
                """
                INSERT INTO perfumes (id, nome, marca, notas, ml, preco, categoria, imagem_url, ativo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(perfume.get("id") or secrets.token_hex(16)),
                    str(perfume.get("nome") or "").strip() or "Perfume",
                    str(perfume.get("marca") or ""),
                    str(perfume.get("notas") or ""),
                    int(perfume.get("ml") or 100),
                    float(perfume.get("preco") or 0),
                    str(perfume.get("categoria") or "Unissex"),
                    perfume.get("imagem_url") or None,
                    1 if perfume.get("ativo", True) else 0,
                    str(perfume.get("created_at") or instante(1)),
                ),
            )
        conn.execute(
            "INSERT INTO loja (chave, valor) VALUES ('whatsapp', ?) ON CONFLICT(chave) DO NOTHING",
            (str(dados.get("whatsapp") or ""),),
        )


def linha(registro: sqlite3.Row) -> dict:
    return {
        "id": registro["id"],
        "nome": registro["nome"],
        "marca": registro["marca"],
        "notas": registro["notas"],
        "ml": registro["ml"],
        "preco": registro["preco"],
        "categoria": registro["categoria"],
        "imagem_url": registro["imagem_url"],
        "ativo": bool(registro["ativo"]),
        "created_at": registro["created_at"],
    }


def listar(somente_ativos: bool) -> list[dict]:
    sql = "SELECT * FROM perfumes"
    if somente_ativos:
        sql += " WHERE ativo = 1"
    sql += " ORDER BY created_at"
    with banco() as conn:
        return [linha(item) for item in conn.execute(sql)]


def obter(id_perfume: str) -> dict | None:
    with banco() as conn:
        registro = conn.execute("SELECT * FROM perfumes WHERE id = ?", (id_perfume,)).fetchone()
    return linha(registro) if registro else None


def whatsapp_loja() -> str:
    with banco() as conn:
        registro = conn.execute("SELECT valor FROM loja WHERE chave = 'whatsapp'").fetchone()
    return registro["valor"] if registro else ""


def salvar_whatsapp(valor: str) -> str | None:
    digitos = re.sub(r"\D", "", valor)
    if digitos and (len(digitos) < 10 or len(digitos) > 13):
        return "Informe o WhatsApp com DDD. Ex.: 11999999999"
    with banco() as conn:
        conn.execute(
            "INSERT INTO loja (chave, valor) VALUES ('whatsapp', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
            (digitos,),
        )
    return None


def imagem_categoria(categoria: str) -> str:
    for item in CATEGORIAS:
        if item["nome"] == categoria:
            return url_for("static", filename=item["imagem"])
    return url_for("static", filename=CATEGORIAS[0]["imagem"])


def formatar_preco(valor: float) -> str:
    texto = f"{valor:,.2f}"
    return "R$ " + texto.replace(",", "X").replace(".", ",").replace("X", ".")


def link_whatsapp(numero: str, nome: str) -> str | None:
    digitos = re.sub(r"\D", "", numero)
    if not digitos:
        return None
    fone = digitos if digitos.startswith("55") else f"55{digitos}"
    texto = f"Olá! Vi o perfume {nome} na vitrine Import Frazão e quero saber mais."
    return f"https://wa.me/{fone}?text={quote(texto)}"


def id_valido(valor: str) -> bool:
    return bool(re.fullmatch(r"[\w-]{8,80}", valor))


def validar_perfume(form) -> dict | str:
    nome = (form.get("nome") or "").strip()
    marca = (form.get("marca") or "").strip()
    notas = (form.get("notas") or "").strip()
    categoria = (form.get("categoria") or "").strip()
    if not nome:
        return "Informe o nome do perfume."
    if len(nome) > 80:
        return "O nome pode ter no máximo 80 caracteres."
    if len(marca) > 80:
        return "A marca pode ter no máximo 80 caracteres."
    if len(notas) > 240:
        return "As notas podem ter no máximo 240 caracteres."
    try:
        ml = int(form.get("ml") or 0)
        preco = float(str(form.get("preco") or "0").replace(",", "."))
    except ValueError:
        return "Informe tamanho e preço válidos."
    if ml < 1 or ml > 1000:
        return "O tamanho precisa estar entre 1 e 1000 ml."
    if preco < 0 or preco > 999999:
        return "Informe um preço válido."
    if categoria not in NOMES_CATEGORIA:
        return "Escolha uma categoria."
    return {
        "nome": nome,
        "marca": marca,
        "notas": notas,
        "ml": ml,
        "preco": round(preco, 2),
        "categoria": categoria,
        "ativo": 1 if form.get("ativo") == "1" else 0,
    }


def cheirar_imagem(conteudo: bytes) -> str | None:
    if conteudo.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(conteudo) >= 12 and conteudo.startswith(b"RIFF") and conteudo[8:12] == b"WEBP":
        return "webp"
    return None


def caminho_foto(url: str | None) -> str | None:
    if not url or not url.startswith("/uploads/perfumes/"):
        return None
    nome = os.path.basename(url)
    if not re.fullmatch(r"[\w.-]+", nome):
        return None
    alvo = os.path.abspath(os.path.join(UPLOADS, nome))
    raiz = os.path.abspath(UPLOADS)
    if os.path.commonpath([alvo, raiz]) != raiz:
        return None
    return alvo


def apagar_foto(url: str | None) -> None:
    alvo = caminho_foto(url)
    if alvo and os.path.isfile(alvo):
        os.remove(alvo)


def guardar_foto(arquivo) -> str | None:
    if not arquivo or not getattr(arquivo, "filename", ""):
        return None
    conteudo = arquivo.read()
    if not conteudo:
        raise ValueError("Escolha uma foto.")
    if len(conteudo) > 8 * 1024 * 1024:
        raise ValueError("A foto precisa ter no máximo 8 MB.")
    extensao = cheirar_imagem(conteudo)
    if not extensao:
        raise ValueError("Envie uma foto JPG, PNG ou WebP.")
    os.makedirs(UPLOADS, exist_ok=True)
    nome = f"{secrets.token_hex(16)}.{extensao}"
    with open(os.path.join(UPLOADS, nome), "wb") as destino:
        destino.write(conteudo)
    return f"/uploads/perfumes/{nome}"


def contexto_comum() -> dict:
    return {"csrf": csrf_token(), "logado": admin_logado(), "formatar_preco": formatar_preco}


@app.before_request
def preparar():
    init_db()


@app.context_processor
def injetar():
    return {"formatar_preco": formatar_preco, "imagem_categoria": imagem_categoria, "link_whatsapp": link_whatsapp}


@app.get("/")
def inicio():
    numero = whatsapp_loja()
    return render_template(
        "index.html",
        perfumes=listar(True),
        categorias=CATEGORIAS,
        whatsapp=numero,
        contato=link_whatsapp(numero, "da coleção"),
    )


@app.get("/uploads/perfumes/<nome>")
def arquivo_foto(nome: str):
    if not re.fullmatch(r"[\w.-]+", nome):
        abort(404)
    return send_from_directory(UPLOADS, nome)


@app.get("/admin")
def admin():
    if not admin_logado():
        return render_template("admin_login.html", csrf=csrf_token())
    return render_template(
        "admin.html",
        perfumes=listar(False),
        categorias=CATEGORIAS,
        whatsapp=whatsapp_loja(),
        csrf=csrf_token(),
    )


@app.post("/admin/entrar")
def entrar():
    if not validar_csrf():
        abort(400)
    informada = request.form.get("senha") or ""
    if not hmac.compare_digest(
        hashlib.sha256(informada.encode()).digest(),
        hashlib.sha256(senha_esperada().encode()).digest(),
    ):
        flash("Senha incorreta.", "erro")
        return redirect(url_for("admin"))
    session["admin"] = True
    session.pop("_csrf", None)
    return redirect(url_for("admin"))


@app.post("/admin/sair")
def sair():
    if not validar_csrf():
        abort(400)
    session.clear()
    return redirect(url_for("admin"))


@app.post("/admin/loja")
def salvar_loja():
    bloqueio = exigir_admin()
    if bloqueio:
        return bloqueio
    if not validar_csrf():
        abort(400)
    erro = salvar_whatsapp(request.form.get("whatsapp") or "")
    flash(erro or "WhatsApp atualizado.", "erro" if erro else "ok")
    return redirect(url_for("admin"))


@app.route("/admin/perfume/novo", methods=["GET", "POST"])
def novo_perfume():
    bloqueio = exigir_admin()
    if bloqueio:
        return bloqueio
    perfume = {
        "id": None,
        "nome": "",
        "marca": "",
        "notas": "",
        "ml": 100,
        "preco": 0,
        "categoria": "Feminino",
        "imagem_url": None,
        "ativo": True,
    }
    if request.method == "POST":
        return gravar_perfume(None, perfume)
    return render_template("perfume_form.html", perfume=perfume, categorias=CATEGORIAS, csrf=csrf_token())


@app.route("/admin/perfume/<id_perfume>", methods=["GET", "POST"])
def editar_perfume(id_perfume: str):
    bloqueio = exigir_admin()
    if bloqueio:
        return bloqueio
    if not id_valido(id_perfume):
        abort(404)
    atual = obter(id_perfume)
    if not atual:
        abort(404)
    if request.method == "POST":
        return gravar_perfume(id_perfume, atual)
    return render_template("perfume_form.html", perfume=atual, categorias=CATEGORIAS, csrf=csrf_token())


def gravar_perfume(id_perfume: str | None, atual: dict):
    if not validar_csrf():
        abort(400)
    dados = validar_perfume(request.form)
    if isinstance(dados, str):
        flash(dados, "erro")
        destino = url_for("editar_perfume", id_perfume=id_perfume) if id_perfume else url_for("novo_perfume")
        return redirect(destino)
    imagem = atual.get("imagem_url")
    try:
        nova = guardar_foto(request.files.get("foto"))
    except ValueError as erro:
        flash(str(erro), "erro")
        destino = url_for("editar_perfume", id_perfume=id_perfume) if id_perfume else url_for("novo_perfume")
        return redirect(destino)
    if nova:
        if imagem and imagem != nova:
            apagar_foto(imagem)
        imagem = nova
    elif request.form.get("remover_foto") == "1":
        apagar_foto(imagem)
        imagem = None
    with banco() as conn:
        if id_perfume:
            conn.execute(
                """
                UPDATE perfumes
                SET nome = ?, marca = ?, notas = ?, ml = ?, preco = ?, categoria = ?, imagem_url = ?, ativo = ?
                WHERE id = ?
                """,
                (dados["nome"], dados["marca"], dados["notas"], dados["ml"], dados["preco"], dados["categoria"], imagem, dados["ativo"], id_perfume),
            )
        else:
            conn.execute(
                """
                INSERT INTO perfumes (id, nome, marca, notas, ml, preco, categoria, imagem_url, ativo, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    secrets.token_hex(16),
                    dados["nome"],
                    dados["marca"],
                    dados["notas"],
                    dados["ml"],
                    dados["preco"],
                    dados["categoria"],
                    imagem,
                    dados["ativo"],
                    datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                ),
            )
    flash("Perfume salvo.", "ok")
    return redirect(url_for("admin"))


@app.post("/admin/perfume/<id_perfume>/ativo")
def alternar_ativo(id_perfume: str):
    bloqueio = exigir_admin()
    if bloqueio:
        return bloqueio
    if not validar_csrf() or not id_valido(id_perfume):
        abort(400)
    with banco() as conn:
        conn.execute("UPDATE perfumes SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ?", (id_perfume,))
    return redirect(url_for("admin"))


@app.post("/admin/perfume/<id_perfume>/excluir")
def excluir_perfume(id_perfume: str):
    bloqueio = exigir_admin()
    if bloqueio:
        return bloqueio
    if not validar_csrf() or not id_valido(id_perfume):
        abort(400)
    atual = obter(id_perfume)
    if not atual:
        abort(404)
    with banco() as conn:
        conn.execute("DELETE FROM perfumes WHERE id = ?", (id_perfume,))
    apagar_foto(atual["imagem_url"])
    flash("Perfume excluído.", "ok")
    return redirect(url_for("admin"))


@app.errorhandler(413)
def arquivo_grande(_erro):
    flash("A foto precisa ter no máximo 8 MB.", "erro")
    return redirect(request.referrer or url_for("admin"))


@app.errorhandler(404)
def nao_encontrado(_erro):
    return render_template("erro.html", titulo="Página não encontrada", mensagem="Esse endereço não existe."), 404


init_db()


if __name__ == "__main__":
    porta = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=porta, debug=os.environ.get("FLASK_DEBUG") == "1")
