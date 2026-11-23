# Essência Perfumada

## PythonAnywhere (Flask + SQLite)

O site que sobe no PythonAnywhere é o app Flask desta pasta. O catálogo fica em `data/catalogo.db` e as fotos em `uploads/perfumes/`. Não precisa de Node nem do Supabase.

1. Envie a pasta do projeto para `/home/SEU_USUARIO/ess-ncia-perfumada`. Deixe de fora `node_modules`, `.venv` e `data/*.db`.
2. No console Bash do PythonAnywhere:

```bash
cd ~/ess-ncia-perfumada
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Em **Web**, crie um app manual (Flask/WSGI), escolha o Python do virtualenv e use o diretório do projeto como working directory.
4. No arquivo WSGI do painel (não é o `wsgi.py` do projeto), cole:

```python
import os
import sys

project = "/home/SEU_USUARIO/ess-ncia-perfumada"
if project not in sys.path:
    sys.path.insert(0, project)

os.environ["ADMIN_PASSWORD"] = "troque-esta-senha"
os.environ["SECRET_KEY"] = "troque-esta-chave-longa"

from wsgi import application
```

5. Aperte **Reload**. A primeira visita cria o SQLite e carrega os perfumes de exemplo.
6. O admin fica em `/admin`.

Para testar nesta máquina: `pip install -r requirements.txt` e `python app.py`. Abre em `http://127.0.0.1:5000`.

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
