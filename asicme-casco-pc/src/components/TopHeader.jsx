const TopHeader = () => {
  return (
    <header className="bg-white/95 border-b border-slate-200 shadow-sm">
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
            <h1 className="text-xl font-semibold text-slate-900">AsicMe Casco</h1>
            <p className="text-sm text-slate-500">Centro de Mando PC</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
