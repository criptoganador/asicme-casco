const TopHeader = () => {
  return (
    <header className="bg-white/95 border-b border-slate-200 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm">
            <img
              src="/logo-app-casco.png"
              alt="AsicMe Casco"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              AsicMe Casco
              <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-sm">
                Centro de Control
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Panel de vigilancia con datos en tiempo real y control total.
            </p>
          </div>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
          Activo • Monitorización en vivo
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
