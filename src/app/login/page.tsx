import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-hope-50 lg:grid-cols-[1fr_560px]">
      <section className="flex min-h-[46vh] items-end bg-[linear-gradient(135deg,rgba(35,127,82,0.92),rgba(16,32,26,0.88)),url('https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center px-6 py-10 text-white lg:min-h-screen lg:px-12">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wide text-gold-100">
            IBE - Igreja Batista Esperanca
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Gestao simples para cuidar melhor da igreja.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/85">
            Uma base moderna para membros, ministerios, eventos e contribuicoes, pronta para
            conectar ao PostgreSQL Neon e publicar na Vercel.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-md border border-hope-100 bg-white p-6 shadow-soft">
          <div className="mb-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-hope-600 text-lg font-bold text-white">
              IBE
            </span>
            <h2 className="mt-5 text-2xl font-bold text-ink-900">Entrar no sistema</h2>
            <p className="mt-2 text-sm text-ink-500">
              Tela inicial preparada para receber autenticacao segura no proximo passo.
            </p>
          </div>

          <form className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-ink-700">
              Email
              <input
                type="email"
                placeholder="admin@ibe.org.br"
                className="rounded-md border-hope-100 focus:border-hope-600 focus:ring-hope-600"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink-700">
              Senha
              <input
                type="password"
                placeholder="••••••••"
                className="rounded-md border-hope-100 focus:border-hope-600 focus:ring-hope-600"
              />
            </label>
            <Link
              href="/dashboard"
              className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-hope-600 px-4 text-sm font-bold text-white transition hover:bg-hope-700"
            >
              Acessar dashboard
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
