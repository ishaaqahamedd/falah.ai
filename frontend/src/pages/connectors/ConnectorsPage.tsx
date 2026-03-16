import { CONNECTORS } from '../../entities/connectors/constants';

export function ConnectorsPage() {
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Connectors</h1>
        <p className="text-text-secondary mt-1">Feed real-world data into your agents — emails, docs, CRM, and more</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CONNECTORS.map((c) => (
          <div
            key={c.id}
            className="bg-surface-secondary border border-border-primary rounded-xl p-6 flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{c.icon}</span>
                <h3 className="font-bold text-text-primary text-lg">{c.name}</h3>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 uppercase tracking-wider whitespace-nowrap">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-text-secondary flex-1">{c.description}</p>
            <button
              disabled
              className="mt-5 w-full py-2.5 border border-border-primary rounded-lg text-sm font-medium text-text-muted cursor-not-allowed"
            >
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
