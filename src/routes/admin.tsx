import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categorias, formatarPreco } from "@/data/perfumes";
import type { EntradaPerfume, Perfume } from "@/lib/perfume";
import {
  atualizarPerfume,
  criarPerfume,
  entrarAdmin,
  enviarFoto,
  excluirPerfume,
  listarAdmin,
  sairAdmin,
  salvarWhatsapp,
  verSessao,
} from "@/lib/perfumes-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Import Frazão" },
      { name: "description", content: "Área administrativa do catálogo Import Frazão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Formulario = EntradaPerfume & { id?: string };

const vazio: Formulario = {
  nome: "",
  marca: "",
  notas: "",
  ml: 100,
  preco: 0,
  categoria: "Feminino",
  imagem_url: null,
  ativo: true,
};

function AdminPage() {
  const [pronto, setPronto] = useState(false);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    verSessao()
      .then((sessao) => setAutenticado(sessao.autenticado))
      .catch(() => setAutenticado(false))
      .finally(() => setPronto(true));
  }, []);

  if (!pronto) return null;
  if (!autenticado) return <Login aoEntrar={() => setAutenticado(true)} />;
  return <Painel aoSair={() => setAutenticado(false)} />;
}

function Centro({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

function Login({ aoEntrar }: { aoEntrar: () => void }) {
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    try {
      await entrarAdmin(senha);
      aoEntrar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Centro>
      <form
        onSubmit={enviar}
        className="w-full max-w-sm space-y-4 border border-border bg-card p-8 text-left"
      >
        <h1 className="text-center font-display text-4xl text-primary">Import Frazão</h1>
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Área admin
        </p>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input
            id="senha"
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          A senha fica em <span className="text-foreground">ADMIN_PASSWORD</span> no arquivo .env.
        </p>
      </form>
    </Centro>
  );
}

function Painel({ aoSair }: { aoSair: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-perfumes"],
    queryFn: listarAdmin,
  });
  const perfumes = data?.perfumes ?? [];
  const [form, setForm] = useState<Formulario | null>(null);
  const [filtro, setFiltro] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [salvandoLoja, setSalvandoLoja] = useState(false);

  useEffect(() => {
    if (data) setWhatsapp(data.whatsapp);
  }, [data]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const lista = perfumes.filter((perfume) => {
    if (filtro !== "Todos" && perfume.categoria !== filtro) return false;
    if (!termo) return true;
    return `${perfume.nome} ${perfume.marca} ${perfume.notas}`
      .toLocaleLowerCase("pt-BR")
      .includes(termo);
  });

  function recarregar() {
    void qc.invalidateQueries({ queryKey: ["admin-perfumes"] });
    void qc.invalidateQueries({ queryKey: ["vitrine"] });
  }

  async function sair() {
    await sairAdmin().catch(() => undefined);
    aoSair();
  }

  async function salvarLoja(evento: FormEvent) {
    evento.preventDefault();
    setSalvandoLoja(true);
    try {
      await salvarWhatsapp(whatsapp);
      toast.success("WhatsApp atualizado");
      recarregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
    } finally {
      setSalvandoLoja(false);
    }
  }

  async function excluir(perfume: Perfume) {
    if (!confirm(`Excluir "${perfume.nome}"?`)) return;
    try {
      await excluirPerfume(perfume.id);
      toast.success("Perfume excluído");
      recarregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  }

  async function alternar(perfume: Perfume) {
    try {
      await atualizarPerfume(perfume.id, { ...perfume, ativo: !perfume.ativo });
      recarregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível atualizar.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="font-display text-2xl text-primary">Import Frazão · Admin</p>
            <p className="text-xs text-muted-foreground">Fotos, preços e o que aparece na vitrine</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/">Ver site</Link>
            </Button>
            <Button variant="ghost" onClick={() => void sair()}>
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <form
          onSubmit={salvarLoja}
          className="flex flex-wrap items-end gap-3 border border-border bg-card p-4"
        >
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="whatsapp">WhatsApp da loja</Label>
            <Input
              id="whatsapp"
              inputMode="tel"
              placeholder="11999999999"
              value={whatsapp}
              onChange={(evento) => setWhatsapp(evento.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={salvandoLoja}>
            {salvandoLoja ? "Salvando…" : "Salvar contato"}
          </Button>
        </form>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-4xl">
            Perfumes <span className="text-muted-foreground">({perfumes.length})</span>
          </h1>
          <Button onClick={() => setForm({ ...vazio })}>+ Novo perfume</Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {["Todos", ...categorias.map((categoria) => categoria.nome)].map((nome) => (
            <Button
              key={nome}
              size="sm"
              variant={filtro === nome ? "default" : "outline"}
              onClick={() => setFiltro(nome)}
            >
              {nome}
            </Button>
          ))}
          <Input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar"
            className="ml-auto w-full sm:w-56"
          />
        </div>

        {isLoading && <p className="mt-8 text-muted-foreground">Carregando…</p>}
        {isError && (
          <div className="mt-8 space-y-3 text-center">
            <p className="text-muted-foreground">Não foi possível carregar os perfumes.</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}

        <div className="mt-6 divide-y divide-border border border-border bg-card">
          {lista.map((perfume) => (
            <div key={perfume.id} className="flex flex-wrap items-center gap-4 p-4">
              <img
                src={perfume.imagem_url || categorias.find((c) => c.nome === perfume.categoria)?.imagem}
                alt=""
                className="h-16 w-16 bg-muted object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl">
                  {perfume.nome}{" "}
                  {!perfume.ativo && (
                    <span className="ml-2 text-xs uppercase text-muted-foreground">(oculto)</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {perfume.marca || "Sem marca"} · {perfume.categoria} · {perfume.ml}ml
                  {!perfume.imagem_url && " · sem foto"}
                </p>
              </div>
              <p className="hidden text-primary sm:block">{formatarPreco(Number(perfume.preco))}</p>
              <Button size="sm" variant="outline" onClick={() => void alternar(perfume)}>
                {perfume.ativo ? "Ocultar" : "Mostrar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ ...perfume, preco: Number(perfume.preco) })}
              >
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void excluir(perfume)}>
                Excluir
              </Button>
            </div>
          ))}
          {!isLoading && lista.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">
              Nenhum perfume aqui. Cadastre um e envie a foto.
            </p>
          )}
        </div>
      </main>
      <Dialog open={!!form} onOpenChange={(aberto) => !aberto && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">
              {form?.id ? "Editar perfume" : "Novo perfume"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <Editor
              form={form}
              setForm={setForm}
              onSalvo={() => {
                setForm(null);
                recarregar();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Editor({
  form,
  setForm,
  onSalvo,
}: {
  form: Formulario;
  setForm: (form: Formulario) => void;
  onSalvo: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const set = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) =>
    setForm({ ...form, [chave]: valor });

  async function foto(arquivo?: File) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      set("imagem_url", await enviarFoto(arquivo));
      toast.success("Foto recebida");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  function soltar(evento: DragEvent) {
    evento.preventDefault();
    void foto(evento.dataTransfer.files[0]);
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    const entrada: EntradaPerfume = {
      nome: form.nome,
      marca: form.marca,
      notas: form.notas,
      ml: form.ml,
      preco: form.preco,
      categoria: form.categoria,
      imagem_url: form.imagem_url,
      ativo: form.ativo,
    };
    try {
      if (form.id) await atualizarPerfume(form.id, entrada);
      else await criarPerfume(entrada);
      toast.success("Perfume salvo");
      onSalvo();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const capa =
    form.imagem_url || categorias.find((categoria) => categoria.nome === form.categoria)?.imagem;

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" required value={form.nome} onChange={(e) => set("nome", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="marca">Marca</Label>
        <Input id="marca" value={form.marca} onChange={(e) => set("marca", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" value={form.notas} onChange={(e) => set("notas", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="preco">Preço (R$)</Label>
          <Input
            id="preco"
            type="number"
            step="0.01"
            min="0"
            value={form.preco}
            onChange={(e) => set("preco", Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ml">Tamanho (ml)</Label>
          <Input
            id="ml"
            type="number"
            min="1"
            value={form.ml}
            onChange={(e) => set("ml", Number(e.target.value))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <div className="flex flex-wrap gap-2">
          {categorias.map((categoria) => (
            <Button
              key={categoria.nome}
              type="button"
              size="sm"
              variant={form.categoria === categoria.nome ? "default" : "outline"}
              onClick={() => set("categoria", categoria.nome)}
            >
              {categoria.nome}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Foto do perfume</Label>
        <label
          onDragOver={(evento) => evento.preventDefault()}
          onDrop={soltar}
          className="flex cursor-pointer flex-col items-center gap-3 border border-dashed border-border bg-muted/40 p-4 text-center"
        >
          {capa && (
            <img src={capa} alt="" className="h-40 w-40 bg-background object-contain" />
          )}
          <span className="text-sm text-muted-foreground">
            {enviando ? "Enviando foto…" : "Clique ou solte a foto aqui · JPG, PNG ou WebP até 8 MB"}
          </span>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="max-w-xs"
            disabled={enviando}
            onChange={(evento) => void foto(evento.target.files?.[0])}
          />
        </label>
        {form.imagem_url && (
          <Button type="button" variant="ghost" size="sm" onClick={() => set("imagem_url", null)}>
            Remover foto
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={form.ativo} onCheckedChange={(valor) => set("ativo", valor)} id="ativo" />
        <Label htmlFor="ativo">Mostrar no site</Label>
      </div>
      <Button type="submit" className="w-full" disabled={salvando || enviando}>
        {salvando ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
