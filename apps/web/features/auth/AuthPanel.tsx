'use client';

import { createContext, useContext, useState } from 'react';

export type PanelVariant = 'default' | 'male' | 'female';

const AUTH_IMAGE =
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1400&q=80';

const TEXTS: Record<PanelVariant, { top: string; big: string }> = {
  default: { top: "Let's", big: 'START' },
  male: { top: 'Oh,', big: 'A GENTLEMAN' },
  female: { top: 'Oh,', big: 'A LADY' },
};

type Ctx = { variant: PanelVariant; setVariant: (v: PanelVariant) => void };

const AuthPanelContext = createContext<Ctx>({ variant: 'default', setVariant: () => {} });

export function useAuthPanel(): Ctx {
  return useContext(AuthPanelContext);
}

export function AuthPanelProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [variant, setVariant] = useState<PanelVariant>('default');
  return (
    <AuthPanelContext.Provider value={{ variant, setVariant }}>{children}</AuthPanelContext.Provider>
  );
}

/** Right-side image panel — its headline reacts to the selected gender. */
export function AuthRightPanel(): React.JSX.Element {
  const { variant } = useAuthPanel();
  const text = TEXTS[variant];
  return (
    <div className="relative hidden h-screen overflow-hidden md:block md:w-1/2">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${AUTH_IMAGE})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-black/5" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <p className="text-5xl font-semibold text-white/90 drop-shadow transition-all duration-300">
          {text.top}
        </p>
        <p className="mt-1 break-words text-6xl font-black uppercase leading-none tracking-tight text-white drop-shadow-lg transition-all duration-300 lg:text-7xl">
          {text.big}
        </p>
      </div>
    </div>
  );
}
