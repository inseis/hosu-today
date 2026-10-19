import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadPublicData, type PublicDataset } from '../data/api';

type State =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: PublicDataset; retry: () => void };

const Ctx = createContext<State>({ status: 'loading' });

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback((force: boolean) => {
    setState({ status: 'loading' });
    loadPublicData(force)
      .then((data) => setState({ status: 'ready', data, retry: () => load(true) }))
      .catch(() => setState({ status: 'error', retry: () => load(true) }));
  }, []);
  useEffect(() => load(false), [load]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useDataset = () => useContext(Ctx);
