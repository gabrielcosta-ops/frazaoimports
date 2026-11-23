import io
import os
import re
import tempfile
import unittest

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0P"
    b"\x0f\x00\x04\x85\x01\x80\x84\xa9\x8c!\x00\x00\x00\x00IEND\xaeB`\x82"
)

fd, banco = tempfile.mkstemp(suffix=".db")
os.close(fd)
uploads = tempfile.mkdtemp()
os.environ["FRAZAO_DB"] = banco
os.environ["FRAZAO_UPLOADS"] = uploads
os.environ["ADMIN_PASSWORD"] = "frazao123"
os.environ["SECRET_KEY"] = "chave-de-teste"

import app as aplicacao  # noqa: E402


class CatalogoSqlite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = aplicacao.app.test_client()

    def token(self, caminho="/admin"):
        pagina = self.client.get(caminho)
        self.assertEqual(pagina.status_code, 200)
        html = pagina.get_data(as_text=True)
        inicio = html.find('name="csrf" value="') + len('name="csrf" value="')
        return html[inicio : html.find('"', inicio)]

    def entrar(self):
        token = self.token()
        resposta = self.client.post(
            "/admin/entrar",
            data={"csrf": token, "senha": "frazao123"},
            follow_redirects=True,
        )
        self.assertIn("Novo perfume", resposta.get_data(as_text=True))
        return resposta

    def test_vitrine_lista_o_sqlite(self):
        pagina = self.client.get("/")
        self.assertEqual(pagina.status_code, 200)
        self.assertIn("Rose Éclat", pagina.get_data(as_text=True))

    def test_senha_errada_nao_entra(self):
        token = self.token()
        resposta = self.client.post(
            "/admin/entrar",
            data={"csrf": token, "senha": "errada"},
            follow_redirects=True,
        )
        self.assertIn("Senha incorreta.", resposta.get_data(as_text=True))

    def test_cria_envia_foto_oculta_e_exclui(self):
        self.entrar()
        token = self.token("/admin/perfume/novo")
        criado = self.client.post(
            "/admin/perfume/novo",
            data={
                "csrf": token,
                "nome": "Frasco Teste",
                "marca": "Casa",
                "notas": "Baunilha",
                "ml": "50",
                "preco": "120",
                "categoria": "Árabes",
                "ativo": "1",
                "foto": (io.BytesIO(PNG), "frasco.png"),
            },
            follow_redirects=True,
        )
        html = criado.get_data(as_text=True)
        self.assertIn("Frasco Teste", html)
        self.assertIn("/uploads/perfumes/", html)
        vitrine = self.client.get("/").get_data(as_text=True)
        self.assertIn("Frasco Teste", vitrine)

        ids = re.findall(r"/admin/perfume/([0-9a-f]{32})", html)
        self.assertTrue(ids)
        id_perfume = ids[-1]
        self.client.post(
            f"/admin/perfume/{id_perfume}/ativo",
            data={"csrf": self.token()},
            follow_redirects=True,
        )
        self.assertNotIn("Frasco Teste", self.client.get("/").get_data(as_text=True))
        excluido = self.client.post(
            f"/admin/perfume/{id_perfume}/excluir",
            data={"csrf": self.token()},
            follow_redirects=True,
        )
        self.assertNotIn("Frasco Teste", excluido.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
