import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Gauge, Music2, Settings } from 'lucide-react';
import MusicLibrary from './MusicLibrary';
import AdminMembers from './AdminMembers';
import SiteCMS from './SiteCMS';
import { WorkspaceAccount, WorkspaceAuthProvider, WorkspaceGuard } from './WorkspaceAuth';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';
import './WorkspacePortals.css';

const MusicTools = lazy(() => import('./MusicTools'));

const workspaceLinks = [
  { to: '/admin', label: 'Admin', title: 'Administração', activePath: 'Admin', accent: '#38bdf8', Icon: Settings },
  { to: '/music', label: 'Música', title: 'Música', activePath: 'Música', accent: '#65a30d', Icon: Music2 },
  { to: '/tools', label: 'Ferramentas', title: 'Ferramentas', activePath: 'Ferramentas', accent: '#f26b4f', Icon: Gauge },
] as const;

function WorkspaceLayout({
  activePath,
  children,
}: {
  activePath: string;
  children: ReactNode;
}) {
  const { memberships } = useWorkspaceAuth();
  const canAdmin = memberships.some((member) => member.roles.some((role) => ['owner', 'admin'].includes(role)));
  return (
    <div className="workspace min-h-screen bg-[#f3f6f5] text-[#182628]">
      <header className="border-b border-[#d6dfdc] bg-white">
        <div className="workspace-header-inner mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link
            to="/"
            aria-label="Collective"
            className="inline-flex items-center font-(family-name:--font0family) text-xl leading-none text-[#1f4644]"
          >
            <span aria-hidden="true">Co</span>
            <img
              aria-hidden="true"
              alt=""
              src="/brand/collective-mark.svg"
              className="mx-[0.04em] inline-block h-[1.35em] w-[1.18em] object-contain"
            />
            <span aria-hidden="true">ective</span>
          </Link>
          <nav aria-label="Áreas da plataforma" className="workspace-nav flex items-center gap-1">
            {workspaceLinks.filter((item) => item.to !== '/admin' || canAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `workspace-nav-link${isActive ? ' is-active' : ''}`}
                style={{ '--workspace-accent': item.accent } as CSSProperties}
                end
              >
                <item.Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <Link to="/" className="workspace-site-link ml-1 px-2 py-1.5 text-sm">
              Site
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6" tabIndex={-1}>
        {workspaceLinks.filter((item) => item.activePath === activePath).map(({ title, activePath: _activePath, accent, Icon }) => (
          <div key={activePath} className="workspace-page-header mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <h1 className="workspace-page-title flex items-center gap-3">
              <Icon size={27} strokeWidth={2.2} aria-hidden="true" style={{ color: accent }} />
              {title}
            </h1>
            <WorkspaceAccount />
          </div>
        ))}
        {children}
        <p className="mt-12 border-t border-[#d6dfdc] pt-4 text-sm text-[#52625f]">
          Workspace: Sardinhas Nômades
        </p>
        <span className="sr-only">Área ativa: {activePath}</span>
      </main>
    </div>
  );
}

export function AdminPortal() {
  return (
    <WorkspaceAuthProvider>
    <WorkspaceLayout activePath="Admin">
      <WorkspaceGuard admin>
      <AdminMembers />
      <SiteCMS />
      </WorkspaceGuard>
    </WorkspaceLayout>
    </WorkspaceAuthProvider>
  );
}

export function MusicPortal() {
  return (
    <WorkspaceAuthProvider>
    <WorkspaceLayout activePath="Música">
      <WorkspaceGuard>
      <MusicLibrary />
      </WorkspaceGuard>
    </WorkspaceLayout>
    </WorkspaceAuthProvider>
  );
}

export function ToolsPortal() {
  return (
    <WorkspaceAuthProvider>
      <WorkspaceLayout activePath="Ferramentas">
        <WorkspaceGuard>
          <Suspense fallback={<p role="status">A carregar instrumentos...</p>}><MusicTools /></Suspense>
        </WorkspaceGuard>
      </WorkspaceLayout>
    </WorkspaceAuthProvider>
  );
}