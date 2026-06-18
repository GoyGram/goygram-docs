import '@radix-ui/themes/styles.css';
import type { ReactNode } from 'react';

export function Provider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
