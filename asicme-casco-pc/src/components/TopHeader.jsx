import { Video } from 'lucide-react';

const TopHeader = () => {
  return (
    <header className="bg-white/95 border-b border-slate-200 shadow-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-100 text-sky-700 border border-sky-200 shadow-sm">
            <Video className="w-5 h-5" />
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
