export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-hope-50 px-6 py-12 text-ink-900">
      <section className="w-full max-w-md rounded-md border border-hope-100 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-hope-600 text-lg font-bold text-white">
          IBE
        </span>
        <h1 className="mt-5 text-2xl font-bold">Você está offline</h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">
          Verifique sua conexão e tente novamente. Algumas páginas públicas podem continuar disponíveis enquanto o app
          estiver instalado.
        </p>
      </section>
    </main>
  );
}
