# Essência Perfumada

## Render (FastAPI + Supabase)

O backend está na pasta `backend` (FastAPI). O catálogo e as fotos ficam no Supabase, não num arquivo local. O `render.yaml` na raiz aponta o serviço para essa pasta.

1. No painel do Supabase, em Storage, crie um bucket chamado `perfumes`.
2. Copie a URL do projeto, a chave publishable e a chave secret (`service_role`).
3. No [Render](https://dashboard.render.com), crie um Blueprint deste repositório. Ele lê o `render.yaml` e usa `backend` como raiz.
4. Preencha `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `ADMIN_PASSWORD`.
5. A vitrine abre na URL do serviço e o admin em `/admin`.

Para testar nesta máquina, dentro de `backend`: `pip install -r requirements.txt` e `python app.py`. Abre em `http://127.0.0.1:5000`. Sem a `SUPABASE_SECRET_KEY`, a vitrine lê o banco, mas o admin não consegue gravar. O `.env` pode ficar na raiz do repositório.

loja de perfumes vitrine catalogo com perfumes . por categoria! faz ai bem tcham

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/94b95655-ba6a-48df-8d69-e4d2955a2b58).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
