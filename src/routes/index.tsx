import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listarVitrine } from "@/lib/perfumes-api";
import { linkCompra, linkWhatsapp, type Perfume } from "@/lib/perfume";
import logo from "@/assets/logo.jpeg.asset.json";
import hero from "@/assets/hero-perfumes.jpg";
import { categorias, formatarPreco, type Categoria } from "@/data/perfumes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Import Frazão — Vitrine de Perfumes Importados" },
      {
        name: "description",
        content: "Perfumes importados femininos, masculinos, árabes e unissex. Conheça a vitrine Import Frazão.",
      },
      { property: "og:title", content: "Import Frazão — Perfumes Importados" },
      { property: "og:description", content: "Vitrine de perfumes importados por categoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const imagemDe = (categoria: string) =>
  categorias.find((item) => item.nome === categoria)?.imagem ?? categorias[0]!.imagem;

function Index() {
  const [ativa, setAtiva] = useState<Categoria | "Todos">("Todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Perfume | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const { data, isError, refetch } = useQuery({
    queryKey: ["vitrine"],
    queryFn: listarVitrine,
    enabled: typeof window !== "undefined",
  });
  const perfumes = data?.perfumes ?? [];
  const whatsapp = data?.whatsapp ?? "";
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const lista = perfumes.filter((perfume) => {
    if (ativa !== "Todos" && perfume.categoria !== ativa) return false;
    if (!termo) return true;
    return `${perfume.nome} ${perfume.marca} ${perfume.notas} ${perfume.categoria}`
      .toLocaleLowerCase("pt-BR")
      .includes(termo);
  });
  const contato = whatsapp ? linkWhatsapp(whatsapp, "da coleção") : null;

  function abrirPerfume(perfume: Perfume) {
    setQuantidade(1);
    setAberto(perfume);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <a href="#topo" className="flex items-center gap-3">
            <Marca />
            <span className="font-display text-2xl tracking-wide text-primary">Import Frazão</span>
          </a>
          <nav className="flex items-center gap-5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <a href="#catalogo" className="hover:text-primary">
              Catálogo
            </a>
            <Link to="/admin" className="hover:text-primary">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section id="topo" className="relative h-[85vh] min-h-[520px] overflow-hidden">
        <img
          src={hero}
          alt="Perfumes sobre pedra e seda"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-center px-6 text-foreground">
          <p className="rise text-xs uppercase tracking-[0.5em] text-primary">Perfumaria importada</p>
          <h1
            className="rise mt-6 max-w-xl font-display text-6xl leading-[0.95] md:text-8xl"
            style={{ animationDelay: ".15s" }}
          >
            A assinatura <em className="text-primary">que fica</em>.
          </h1>
          <p
            className="rise mt-6 max-w-md text-lg font-light opacity-90"
            style={{ animationDelay: ".3s" }}
          >
            Fragrâncias selecionadas do mundo todo, para cada momento e personalidade.
          </p>
          <a
            href="#catalogo"
            className="rise mt-10 w-fit border border-primary bg-background/70 px-8 py-4 text-xs uppercase tracking-[0.3em] text-primary transition hover:bg-primary hover:text-primary-foreground"
            style={{ animationDelay: ".45s" }}
          >
            Ver coleção
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center font-display text-5xl text-foreground">Categorias</h2>
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {categorias.map((categoria) => (
            <a
              key={categoria.nome}
              href="#catalogo"
              onClick={() => setAtiva(categoria.nome)}
              className="group relative aspect-[3/4] overflow-hidden"
            >
              <img
                src={categoria.imagem}
                alt={categoria.nome}
                loading="lazy"
                width={1024}
                height={1024}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
              <div className="absolute bottom-0 p-5 text-ink-foreground">
                <h3 className="font-display text-3xl">{categoria.nome}</h3>
                <p className="text-sm font-light opacity-80">{categoria.descricao}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="catalogo" className="scroll-mt-20 bg-card py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-5xl">Catálogo</h2>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {!data && !isError
              ? "Carregando a coleção…"
              : `${lista.length} ${lista.length === 1 ? "fragrância" : "fragrâncias"}`}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {(["Todos", ...categorias.map((categoria) => categoria.nome)] as const).map((nome) => (
              <button
                key={nome}
                onClick={() => setAtiva(nome)}
                className={`px-5 py-2 text-xs uppercase tracking-[0.25em] transition ${ativa === nome ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"}`}
              >
                {nome}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar perfume, marca ou nota"
              className="w-full max-w-md border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          {isError && (
            <div className="mt-12 text-center">
              <p className="text-muted-foreground">Não foi possível carregar o catálogo.</p>
              <button
                onClick={() => void refetch()}
                className="mt-4 border border-primary px-5 py-2 text-xs uppercase tracking-[0.25em] text-primary"
              >
                Tentar de novo
              </button>
            </div>
          )}
          {data && !isError && lista.length === 0 && (
            <p className="mt-12 text-center text-muted-foreground">
              Nenhum perfume nessa seleção.
            </p>
          )}
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((perfume) => {
              return (
                <article key={perfume.id} className="group rise border border-border/70 bg-background">
                  <button
                    type="button"
                    onClick={() => abrirPerfume(perfume)}
                    aria-label={`Ver ${perfume.nome}`}
                    className="block aspect-square w-full overflow-hidden bg-muted text-left"
                  >
                    <img
                      src={perfume.imagem_url || imagemDe(perfume.categoria)}
                      alt={perfume.nome}
                      loading="lazy"
                      width={1024}
                      height={1024}
                      className={`h-full w-full transition duration-700 group-hover:scale-105 ${perfume.imagem_url ? "object-contain p-8" : "object-cover"}`}
                    />
                  </button>
                  <div className="p-5">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                      {perfume.marca || "Import Frazão"} · {perfume.categoria}
                    </p>
                    <h3 className="mt-1 font-display text-3xl">{perfume.nome}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[perfume.notas, `${perfume.ml}ml`].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-3 text-lg text-primary">
                      {perfume.preco > 0 ? formatarPreco(Number(perfume.preco)) : "Sob consulta"}
                    </p>
                    <button
                      type="button"
                      onClick={() => abrirPerfume(perfume)}
                      className="mt-4 text-xs uppercase tracking-[0.25em] text-primary underline-offset-4 hover:underline"
                    >
                      Ver e comprar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bg-ink py-12 text-center text-ink-foreground">
        <p className="font-display text-3xl">Import Frazão</p>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] opacity-60">Perfumes importados</p>
      </footer>

      {contato && (
        <a
          href={contato}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-6 right-6 z-30 border border-primary bg-background px-5 py-3 text-xs uppercase tracking-[0.25em] text-primary shadow-sm"
        >
          WhatsApp
        </a>
      )}

      <Dialog open={!!aberto} onOpenChange={(open) => !open && setAberto(null)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          {aberto && (
            <Ficha
              perfume={aberto}
              quantidade={quantidade}
              aoMudarQuantidade={setQuantidade}
              whatsapp={whatsapp}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Ficha({
  perfume,
  quantidade,
  aoMudarQuantidade,
  whatsapp,
}: {
  perfume: Perfume;
  quantidade: number;
  aoMudarQuantidade: (valor: number) => void;
  whatsapp: string;
}) {
  const compra = linkCompra(whatsapp, perfume, quantidade);
  const unitario = perfume.preco > 0 ? formatarPreco(Number(perfume.preco)) : "Sob consulta";
  const total = perfume.preco > 0 ? formatarPreco(Number(perfume.preco) * quantidade) : "Sob consulta";
  const linhas = [
    ["Marca", perfume.marca || "Import Frazão"],
    ["Categoria", perfume.categoria],
    ["Volume", `${perfume.ml} ml`],
    ["Notas", perfume.notas || "Não informadas"],
    ["Preço", unitario],
  ];

  return (
    <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <img
        src={perfume.imagem_url || imagemDe(perfume.categoria)}
        alt={perfume.nome}
        className={`min-h-64 w-full bg-muted md:min-h-full ${perfume.imagem_url ? "object-contain p-8" : "object-cover"}`}
      />
      <div className="flex flex-col gap-5 p-6 pr-12">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{perfume.categoria}</p>
          <DialogTitle className="mt-2 font-display text-4xl leading-none">{perfume.nome}</DialogTitle>
        </div>
        <dl className="divide-y divide-border border border-border">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center border border-border">
            <button
              type="button"
              className="px-4 py-2 text-lg"
              onClick={() => aoMudarQuantidade(Math.max(1, quantidade - 1))}
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="min-w-8 text-center text-sm">{quantidade}</span>
            <button
              type="button"
              className="px-4 py-2 text-lg"
              onClick={() => aoMudarQuantidade(Math.min(20, quantidade + 1))}
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>
          <p className="text-right">
            <span className="block text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Total</span>
            <span className="font-display text-3xl text-primary">{total}</span>
          </p>
        </div>
        {compra ? (
          <a
            href={compra}
            target="_blank"
            rel="noreferrer"
            className="bg-primary px-6 py-4 text-center text-xs uppercase tracking-[0.3em] text-primary-foreground"
          >
            Comprar no WhatsApp
          </a>
        ) : (
          <p className="border border-border px-4 py-3 text-sm text-muted-foreground">
            O WhatsApp da loja ainda não foi cadastrado no admin.
          </p>
        )}
      </div>
    </div>
  );
}

function Marca() {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <span className="grid h-12 w-12 place-items-center rounded-full border border-primary font-display text-lg text-primary">
        IF
      </span>
    );
  }
  return (
    <img
      src={logo.url}
      alt="Import Frazão"
      className="h-12 w-12 rounded-full object-cover object-[50%_35%]"
      onError={() => setFalhou(true)}
    />
  );
}
