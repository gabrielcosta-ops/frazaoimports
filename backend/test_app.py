import os
import unittest

os.environ.setdefault("ADMIN_PASSWORD", "frazao123")
os.environ.setdefault("SECRET_KEY", "chave-de-teste")

from fastapi.testclient import TestClient

import app as aplicacao


class CatalogoSupabase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(aplicacao.app)

    def token(self, caminho: str) -> str:
        html = self.client.get(caminho).text
        marca = 'name="csrf" value="'
        inicio = html.find(marca) + len(marca)
        return html[inicio : html.find('"', inicio)]

    def test_saude(self):
        self.assertEqual(self.client.get("/health").json(), {"ok": True})

    def test_vitrine_le_o_supabase(self):
        pagina = self.client.get("/")
        self.assertEqual(pagina.status_code, 200)
        self.assertIn("Rose Éclat", pagina.text)

    def test_senha_errada(self):
        resposta = self.client.post(
            "/admin/entrar",
            data={"csrf": self.token("/admin"), "senha": "errada"},
            follow_redirects=True,
        )
        self.assertIn("Senha incorreta.", resposta.text)

    def test_admin_entra_e_avisa_se_nao_pode_gravar(self):
        pagina = self.client.post(
            "/admin/entrar",
            data={"csrf": self.token("/admin"), "senha": "frazao123"},
            follow_redirects=True,
        )
        self.assertEqual(pagina.status_code, 200)
        self.assertIn("Rose Éclat", pagina.text)
        if not aplicacao.chave_secreta():
            self.assertIn("SUPABASE_SECRET_KEY", pagina.text)


if __name__ == "__main__":
    unittest.main()
