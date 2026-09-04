import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  History,
  LayoutDashboard,
  Map,
  Settings,
  Shield,
  ShieldAlert,
  Users
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Overview', active: true },
    { icon: <AlertCircle size={20} />, label: 'Active incidents', badge: 9 },
    { icon: <History size={20} />, label: 'Incident history' },
    { icon: <ShieldAlert size={20} />, label: 'Emergency center', badge: 4 },
    { icon: <Map size={20} />, label: 'Live map' },
    { icon: <AlertCircle size={20} />, label: 'SOS / Emergency', badge: 5 },
    { icon: <Settings size={20} />, label: 'Evidence' },
    { icon: <Users size={20} />, label: 'Security officers' },
    { icon: <Settings size={20} />, label: 'User management' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-2 text-blue-600 font-bold text-xl">
          <Shield fill="currentColor" /> <span>CampusSecure</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Workspace</p>
          {menuItems.map((item, i) => (
            <div key={i} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${item.active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>
              <div className="flex items-center gap-3 font-medium">
                {item.icon} <span className="text-sm">{item.label}</span>
              </div>
              {item.badge && <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded-full">{item.badge}</span>}
            </div>
          ))}
        </nav>

        <div className="p-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm mb-3">
              <CheckCircle className="text-emerald-500" size={18} />
            </div>
            <h4 className="font-bold text-sm text-emerald-900">Response readiness</h4>
            <p className="text-[11px] text-emerald-700 mt-1">Keep your campus response team informed and connected.</p>
          </div>

          <div className="mt-4 flex items-center gap-3 p-2 border rounded-xl bg-slate-50">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs">CD</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">CampusSecure...</p>
              <span className="text-[10px] bg-slate-200 px-1 rounded font-bold uppercase">Admin</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Campus Security / <span className="text-slate-900">Overview</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-sm font-medium border px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Notifications <span className="bg-slate-900 text-white text-[10px] px-1 rounded">9</span>
            </button>
            <button className="text-sm font-medium border px-3 py-1.5 rounded-lg text-slate-600">Clear history</button>
            <div className="flex items-center gap-2 border-l pl-4">
              <div className="bg-slate-900 text-white w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold">CD</div>
              <div className="text-xs">
                <p className="font-bold">CampusSecure Development...</p>
                <p className="text-[10px] text-slate-500 uppercase">Admin</p>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
            <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              <AlertCircle size={16} /> Report incident
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;