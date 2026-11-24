import hashlib
import hmac
import os
import re
import secrets
from urllib.parse import quote

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from supabase import create_client

BASE = os.path.dirname(os.path.abspath(__file__))
CATEGORIAS = [
    {"nome": "Feminino", "descricao": "Florais, doces e envolventes", "imagem": "img/cat-feminino.jpg"},
    {"nome": "Masculino", "descricao": "Amadeirados e marcantes", "imagem": "img/cat-masculino.jpg"},
    {"nome": "Árabes", "descricao": "Oud, âmbar e intensidade", "imagem": "img/cat-arabe.jpg"},
    {"nome": "Unissex", "descricao": "Frescos e elegantes", "imagem": "img/cat-unissex.jpg"},
]
NOMES_CATEGORIA = {item["nome"] for item in CATEGORIAS}
_clientes: dict[str, object] = {}
_tem_loja: bool | None = None


class ErroApp(Exception):
    def __init__(self, mensagem: str) -> None:
        self.mensagem = mensagem


def ler_env_arquivo(nome: str) -> str | None:
    for caminho in (os.path.join(BASE, ".env"), os.path.join(BASE, "..", ".env")):
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
            continue
    return None


def env(nome: str, padrao: str = "") -> str:
    return os.environ.get(nome) or ler_env_arquivo(nome) or padrao


def url_supabase() -> str:
    endereco = env("SUPABASE_URL")
    if not endereco:
        raise ErroApp("Defina SUPABASE_URL.")
    return endereco.rstrip("/")


def chave_publica() -> str:
    chave = env("SUPABASE_PUBLISHABLE_KEY") or env("SUPABASE_ANON_KEY")
    if not chave:
        raise ErroApp("Defina SUPABASE_PUBLISHABLE_KEY.")
    return chave


def chave_secreta() -> str:
    return env("SUPABASE_SECRET_KEY") or env("SUPABASE_SERVICE_ROLE_KEY")


def cliente(privilegiado: bool = False):
    if privilegiado:
        chave = chave_secreta()
        if not chave:
            raise ErroApp("Defina SUPABASE_SECRET_KEY no Render para gravar no Supabase.")
    else:
        chave = chave_publica()
    pronto = _clientes.get(chave)
    if pronto is None:
        pronto = create_client(url_supabase(), chave)
        _clientes[chave] = pronto
    return pronto


def senha_confere(informada: str) -> bool:
    esperada = env("ADMIN_PASSWORD", "frazao123")
    return hmac.compare_digest(
        hashlib.sha256(informada.encode()).digest(),
        hashlib.sha256(esperada.encode()).digest(),
    )


def url_pagina(endpoint: str, **params: str) -> str:
    if endpoint == "static":
        return "/static/" + params["filename"].lstrip("/")
    if endpoint == "editar_perfume":
        return f"/admin/perfume/{params['id_perfume']}"
    if endpoint == "alternar_ativo":
        return f"/admin/perfume/{params['id_perfume']}/ativo"
    if endpoint == "excluir_perfume":
        return f"/admin/perfume/{params['id_perfume']}/excluir"
    return {
        "inicio": "/",
        "admin": "/admin",
        "entrar": "/admin/entrar",
        "sair": "/admin/sair",
        "salvar_loja": "/admin/loja",
        "novo_perfume": "/admin/perfume/novo",
    }[endpoint]


def formatar_preco(valor: float) -> str:
    texto = f"{float(valor):,.2f}"
    return "R$ " + texto.replace(",", "X").replace(".", ",").replace("X", ".")


def imagem_categoria(categoria: str) -> str:
    for item in CATEGORIAS:
        if item["nome"] == categoria:
            return url_pagina("static", filename=item["imagem"])
    return url_pagina("static", filename=CATEGORIAS[0]["imagem"])


def link_whatsapp(numero: str, nome: str) -> str | None:
    digitos = re.sub(r"\D", "", numero or "")
    if not digitos:
        return None
    fone = digitos if digitos.startswith("55") else f"55{digitos}"
    texto = f"Olá! Vi o perfume {nome} na vitrine Import Frazão e quero saber mais."
    return f"https://wa.me/{fone}?text={quote(texto)}"


def normalizar(item: dict) -> dict:
    return {
        "id": item["id"],
        "nome": item.get("nome") or "",
        "marca": item.get("marca") or "",
        "notas": item.get("notas") or "",
        "ml": int(item.get("ml") or 100),
        "preco": float(item.get("preco") or 0),
        "categoria": item.get("categoria") or "Unissex",
        "imagem_url": item.get("imagem_url"),
        "ativo": bool(item.get("ativo")),
        "created_at": item.get("created_at") or "",
    }


def listar(somente_ativos: bool) -> list[dict]:
    consulta = cliente(privilegiado=not somente_ativos and bool(chave_secreta())).table("perfumes").select("*")
    if somente_ativos or not chave_secreta():
        consulta = consulta.eq("ativo", True)
    dados = consulta.order("created_at").execute().data or []
    return [normalizar(item) for item in dados]


def obter(id_perfume: str) -> dict | None:
    dados = (
        cliente(privilegiado=bool(chave_secreta()))
        .table("perfumes")
        .select("*")
        .eq("id", id_perfume)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not dados:
        return None
    perfume = normalizar(dados[0])
    if not perfume["ativo"] and not chave_secreta():
        return None
    return perfume


def tem_loja() -> bool:
    global _tem_loja
    if _tem_loja is not None:
        return _tem_loja
    try:
        cliente(privilegiado=bool(chave_secreta())).table("loja").select("chave").limit(1).execute()
        _tem_loja = True
    except Exception:
        _tem_loja = False
    return _tem_loja


def whatsapp_loja() -> str:
    if not tem_loja():
        return ""
    dados = (
        cliente(privilegiado=bool(chave_secreta()))
        .table("loja")
        .select("valor")
        .eq("chave", "whatsapp")
        .limit(1)
        .execute()
        .data
        or []
    )
    return str(dados[0]["valor"]) if dados else ""


def salvar_whatsapp(valor: str) -> str | None:
    digitos = re.sub(r"\D", "", valor)
    if digitos and (len(digitos) < 10 or len(digitos) > 13):
        return "Informe o WhatsApp com DDD. Ex.: 11999999999"
    cliente(privilegiado=True).table("loja").upsert({"chave": "whatsapp", "valor": digitos}).execute()
    return None


def mensagem_supabase(erro: Exception) -> str:
    texto = str(erro)
    if "row-level security" in texto.lower() or "42501" in texto:
        return "O Supabase recusou a gravação. Confira a SUPABASE_SECRET_KEY."
    if "Bucket not found" in texto or "bucket" in texto.lower() and "not found" in texto.lower():
        return "Crie o bucket público 'perfumes' no Storage do Supabase."
    if isinstance(erro, ErroApp):
        return erro.mensagem
    return "Não foi possível falar com o Supabase."


def id_valido(valor: str) -> bool:
    return bool(re.fullmatch(r"[\w-]{8,80}", valor))


def validar_perfume(form: dict) -> dict | str:
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
        "ativo": form.get("ativo") == "1",
    }


def cheirar_imagem(conteudo: bytes) -> tuple[str, str] | None:
    if conteudo.startswith(b"\xff\xd8\xff"):
        return "jpg", "image/jpeg"
    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "image/png"
    if len(conteudo) >= 12 and conteudo.startswith(b"RIFF") and conteudo[8:12] == b"WEBP":
        return "webp", "image/webp"
    return None


def caminho_storage(url: str | None) -> str | None:
    if not url or "/perfumes/" not in url:
        return None
    nome = url.split("/perfumes/", 1)[1].split("?")[0].split("/")[-1]
    if not re.fullmatch(r"[\w.-]+", nome):
        return None
    return nome


def guardar_foto(conteudo: bytes) -> str:
    if len(conteudo) > 8 * 1024 * 1024:
        raise ErroApp("A foto precisa ter no máximo 8 MB.")
    tipo = cheirar_imagem(conteudo)
    if not tipo:
        raise ErroApp("Envie uma foto JPG, PNG ou WebP.")
    extensao, mime = tipo
    nome = f"{secrets.token_hex(16)}.{extensao}"
    armazenamento = cliente(privilegiado=True).storage.from_("perfumes")
    armazenamento.upload(nome, conteudo, {"content-type": mime})
    assinada = armazenamento.create_signed_url(nome, 60 * 60 * 24 * 365 * 5)
    return assinada.get("signedURL") or assinada.get("signedUrl") or armazenamento.get_public_url(nome)


def apagar_foto(url: str | None) -> None:
    nome = caminho_storage(url)
    if not nome or not chave_secreta():
        return
    try:
        cliente(privilegiado=True).storage.from_("perfumes").remove([nome])
    except Exception:
        return


def csrf_token(request: Request) -> str:
    token = request.session.get("_csrf")
    if not isinstance(token, str) or not token:
        token = secrets.token_urlsafe(32)
        request.session["_csrf"] = token
    return token


def csrf_ok(request: Request, enviado: str) -> bool:
    esperado = request.session.get("_csrf", "")
    if not isinstance(esperado, str) or not esperado or not enviado:
        return False
    return hmac.compare_digest(enviado, esperado)


def avisar(request: Request, texto: str, tipo: str = "ok") -> None:
    fila = list(request.session.get("avisos", []))
    fila.append([tipo, texto])
    request.session["avisos"] = fila


def render(request: Request, nome: str, contexto: dict | None = None, status: int = 200):
    avisos = request.session.pop("avisos", [])
    dados = {
        "formatar_preco": formatar_preco,
        "imagem_categoria": imagem_categoria,
        "link_whatsapp": link_whatsapp,
        "get_flashed_messages": lambda with_categories=True: avisos,
        **(contexto or {}),
    }
    return templates.TemplateResponse(request, nome, dados, status_code=status)


def redirecionar(caminho: str) -> RedirectResponse:
    return RedirectResponse(caminho, status_code=303)


def exigir_admin(request: Request) -> RedirectResponse | None:
    if request.session.get("admin"):
        return None
    avisar(request, "Entre para continuar.", "erro")
    return redirecionar("/admin")


app = FastAPI(title="Import Frazão")
app.add_middleware(
    SessionMiddleware,
    secret_key=env("SECRET_KEY", env("ADMIN_SECRET", "import-frazao-troque-esta-chave")),
    same_site="lax",
    https_only=os.environ.get("RENDER") == "true",
)
app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE, "templates"))
templates.env.globals["url_for"] = url_pagina


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/")
def inicio(request: Request):
    try:
        numero = whatsapp_loja()
        perfumes = listar(True)
    except Exception as erro:
        return render(
            request,
            "erro.html",
            {"titulo": "Catálogo indisponível", "mensagem": mensagem_supabase(erro)},
            500,
        )
    return render(
        request,
        "index.html",
        {
            "perfumes": perfumes,
            "categorias": CATEGORIAS,
            "whatsapp": numero,
            "contato": link_whatsapp(numero, "da coleção"),
        },
    )


@app.get("/admin")
def admin(request: Request):
    if not request.session.get("admin"):
        return render(request, "admin_login.html", {"csrf": csrf_token(request)})
    try:
        perfumes = listar(False)
        numero = whatsapp_loja()
    except Exception as erro:
        avisar(request, mensagem_supabase(erro), "erro")
        perfumes = []
        numero = ""
    return render(
        request,
        "admin.html",
        {
            "perfumes": perfumes,
            "categorias": CATEGORIAS,
            "whatsapp": numero,
            "csrf": csrf_token(request),
            "pode_gravar": bool(chave_secreta()),
            "tem_loja": tem_loja(),
        },
    )


@app.post("/admin/entrar")
def entrar(request: Request, senha: str = Form(""), csrf: str = Form("")):
    if not csrf_ok(request, csrf):
        return JSONResponse({"erro": "Sessão inválida."}, status_code=400)
    if not senha_confere(senha):
        avisar(request, "Senha incorreta.", "erro")
        return redirecionar("/admin")
    request.session["admin"] = True
    request.session.pop("_csrf", None)
    return redirecionar("/admin")


@app.post("/admin/sair")
def sair(request: Request, csrf: str = Form("")):
    if not csrf_ok(request, csrf):
        return JSONResponse({"erro": "Sessão inválida."}, status_code=400)
    request.session.clear()
    return redirecionar("/admin")


@app.post("/admin/loja")
def salvar_loja(request: Request, whatsapp: str = Form(""), csrf: str = Form("")):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    if not csrf_ok(request, csrf):
        return JSONResponse({"erro": "Sessão inválida."}, status_code=400)
    try:
        erro = salvar_whatsapp(whatsapp)
    except Exception as falha:
        avisar(request, mensagem_supabase(falha), "erro")
        return redirecionar("/admin")
    avisar(request, erro or "WhatsApp atualizado.", "erro" if erro else "ok")
    return redirecionar("/admin")


@app.get("/admin/perfume/novo")
def novo_perfume(request: Request):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    return render(
        request,
        "perfume_form.html",
        {"perfume": perfume_vazio(), "categorias": CATEGORIAS, "csrf": csrf_token(request)},
    )


@app.post("/admin/perfume/novo")
async def criar_perfume(
    request: Request,
    nome: str = Form(""),
    marca: str = Form(""),
    notas: str = Form(""),
    ml: str = Form("100"),
    preco: str = Form("0"),
    categoria: str = Form(""),
    ativo: str | None = Form(None),
    csrf: str = Form(""),
    foto: UploadFile | None = File(None),
):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    return await gravar(
        request,
        None,
        {"nome": nome, "marca": marca, "notas": notas, "ml": ml, "preco": preco, "categoria": categoria, "ativo": ativo},
        foto,
        csrf,
        None,
    )


@app.get("/admin/perfume/{id_perfume}")
def editar_perfume(request: Request, id_perfume: str):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    if not id_valido(id_perfume):
        return render(request, "erro.html", {"titulo": "Não encontrado", "mensagem": "Esse perfume não existe."}, 404)
    atual = obter(id_perfume)
    if not atual:
        return render(request, "erro.html", {"titulo": "Não encontrado", "mensagem": "Esse perfume não existe."}, 404)
    return render(
        request,
        "perfume_form.html",
        {"perfume": atual, "categorias": CATEGORIAS, "csrf": csrf_token(request)},
    )


@app.post("/admin/perfume/{id_perfume}")
async def atualizar_perfume(
    request: Request,
    id_perfume: str,
    nome: str = Form(""),
    marca: str = Form(""),
    notas: str = Form(""),
    ml: str = Form("100"),
    preco: str = Form("0"),
    categoria: str = Form(""),
    ativo: str | None = Form(None),
    remover_foto: str | None = Form(None),
    csrf: str = Form(""),
    foto: UploadFile | None = File(None),
):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    return await gravar(
        request,
        id_perfume,
        {"nome": nome, "marca": marca, "notas": notas, "ml": ml, "preco": preco, "categoria": categoria, "ativo": ativo},
        foto,
        csrf,
        remover_foto,
    )


async def gravar(
    request: Request,
    id_perfume: str | None,
    form: dict,
    foto: UploadFile | None,
    csrf: str,
    remover_foto: str | None,
):
    destino = f"/admin/perfume/{id_perfume}" if id_perfume else "/admin/perfume/novo"
    if not csrf_ok(request, csrf) or (id_perfume and not id_valido(id_perfume)):
        return JSONResponse({"erro": "Sessão inválida."}, status_code=400)
    dados = validar_perfume(form)
    if isinstance(dados, str):
        avisar(request, dados, "erro")
        return redirecionar(destino)
    atual = obter(id_perfume) if id_perfume else None
    if id_perfume and not atual:
        return render(request, "erro.html", {"titulo": "Não encontrado", "mensagem": "Esse perfume não existe."}, 404)
    imagem = atual["imagem_url"] if atual else None
    try:
        conteudo = await foto.read() if foto and foto.filename else b""
        if conteudo:
            nova = guardar_foto(conteudo)
            if imagem and imagem != nova:
                apagar_foto(imagem)
            imagem = nova
        elif remover_foto == "1":
            apagar_foto(imagem)
            imagem = None
        payload = {**dados, "imagem_url": imagem}
        banco = cliente(privilegiado=True).table("perfumes")
        if id_perfume:
            banco.update(payload).eq("id", id_perfume).execute()
        else:
            banco.insert(payload).execute()
    except Exception as erro:
        avisar(request, mensagem_supabase(erro), "erro")
        return redirecionar(destino)
    avisar(request, "Perfume salvo.", "ok")
    return redirecionar("/admin")


@app.post("/admin/perfume/{id_perfume}/ativo")
def alternar_ativo(request: Request, id_perfume: str, csrf: str = Form("")):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    if not csrf_ok(request, csrf) or not id_valido(id_perfume):
        return JSONResponse({"erro": "Sessão inválida."}, status_code=400)
    try:
        atual = obter(id_perfume)
        if not atual:
            return render(request, "erro.html", {"titulo": "Não encontrado", "mensagem": "Esse perfume não existe."}, 404)
        cliente(privilegiado=True).table("perfumes").update({"ativo": not atual["ativo"]}).eq("id", id_perfume).execute()
    except Exception as erro:
        avisar(request, mensagem_supabase(erro), "erro")
    return redirecionar("/admin")


@app.post("/admin/perfume/{id_perfume}/excluir")
def excluir_perfume(request: Request, id_perfume: str, csrf: str = Form("")):
    bloqueio = exigir_admin(request)
    if bloqueio:
        return bloqueio
    if not csrf_ok(request, csrf) or not id_valido(id_perfume):
        return JSONResponse({"erro": "Sessão inválida."}, status_code=400)
    try:
        atual = obter(id_perfume)
        if not atual:
            return render(request, "erro.html", {"titulo": "Não encontrado", "mensagem": "Esse perfume não existe."}, 404)
        cliente(privilegiado=True).table("perfumes").delete().eq("id", id_perfume).execute()
        apagar_foto(atual["imagem_url"])
    except Exception as erro:
        avisar(request, mensagem_supabase(erro), "erro")
        return redirecionar("/admin")
    avisar(request, "Perfume excluído.", "ok")
    return redirecionar("/admin")


def perfume_vazio() -> dict:
    return {
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


@app.exception_handler(404)
def nao_encontrado(request: Request, _erro):
    return render(request, "erro.html", {"titulo": "Página não encontrada", "mensagem": "Esse endereço não existe."}, 404)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0" if os.environ.get("RENDER") == "true" else "127.0.0.1",
        port=int(os.environ.get("PORT", "5000")),
    )
