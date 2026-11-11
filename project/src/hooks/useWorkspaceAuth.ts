import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type Membership = { band_id: string; roles: string[]; bands: { name: string } | null };
export type WorkspaceAuthState = {
  session: Session | null;
  memberships: Membership[];
  loading: boolean;
  error: string;
  reload: () => void;
};

export const WorkspaceAuthContext = createContext<WorkspaceAuthState | null>(null);

export function useWorkspaceAuth() {
  const state = useContext(WorkspaceAuthContext);
  if (!state) throw new Error('Workspace authentication provider is missing.');
  return state;
}