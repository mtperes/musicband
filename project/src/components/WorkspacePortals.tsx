import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import MusicLibrary from './MusicLibrary';
import AdminMembers from './AdminMembers';
import { WorkspaceAccount, WorkspaceAuthProvider, WorkspaceGuard } from './WorkspaceAuth';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';
import './WorkspacePortals.css';

const workspaceLinks = [
  { to: '/admin', label: 'Admin' },
  { to: '/music', label: 'Música' },
];

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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="font-(family-name:--font0family) text-xl text-[#1f4644]">
            Collective
          </Link>
          <nav aria-label="Áreas da plataforma" className="flex items-center gap-2">
            {workspaceLinks.filter((item) => item.to !== '/admin' || canAdmin).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-[#dcece7] text-[#174c45]' : 'text-[#435552] hover:bg-[#edf2f0]'
                  }`
                }
                end
              >
                {item.label}
              </NavLink>
            ))}
            <Link to="/" className="ml-2 px-2 py-2 text-sm text-[#435552] underline underline-offset-4">
              Site público
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12" tabIndex={-1}>
        <div className="mb-4 flex justify-end"><WorkspaceAccount /></div>
        {children}
        <p className="mt-12 border-t border-[#d6dfdc] pt-4 text-sm text-[#52625f]">
          Workspace: Sardinhas Nômades
        </p>
        <span className="sr-only">Área ativa: {activePath}</span>
      </main>
    </div>
  );
}

function FeatureList({ items }: { items: { title: string; description: string }[] }) {
  return (
    <ul className="mt-8 divide-y divide-[#d6dfdc] border-y border-[#d6dfdc]">
      {items.map((item) => (
        <li key={item.title} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <span className="font-medium">{item.title}</span>
          <span className="text-sm text-[#52625f]">{item.description}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminPortal() {
  return (
    <WorkspaceAuthProvider>
    <WorkspaceLayout activePath="Admin">
      <WorkspaceGuard admin>
      <p className="text-sm font-medium uppercase text-[#39736b]">Gestão da banda</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Administração</h1>
      <AdminMembers />
      <FeatureList
        items={[
          { title: 'Perfil e identidade', description: 'Gestão de conteúdo por configurar' },
          { title: 'Agenda e eventos', description: 'Integração de escrita por configurar' },
          { title: 'Galeria e vídeos', description: 'Biblioteca de media por configurar' },
        ]}
      />
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