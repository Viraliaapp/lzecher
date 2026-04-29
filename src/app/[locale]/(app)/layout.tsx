"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "@/i18n/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useEffect } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-cream">{children}</main>
      <Footer />
    </>
  );
}
