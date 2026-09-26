import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

/** Shared chrome for all public pages (design.md §A.1). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white-soft">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
