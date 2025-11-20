"use client";

import { useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

function AuthCallbackContent() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Get the hash fragment which contains the session
      const hash = window.location.hash;
      
      if (hash) {
        try {
          // Supabase will automatically handle the hash fragment
          // Just redirect to chat after a short delay
          setTimeout(() => {
            router.push("/chat");
          }, 500);
        } catch (err) {
          console.error("Callback error:", err);
          router.push("/auth/login?error=Authentication failed");
        }
      } else {
        // No hash, check if user is authenticated
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            router.push("/chat");
          } else {
            router.push("/auth/login");
          }
        } catch {
          router.push("/auth/login");
        }
      }
    };

    handleAuthCallback();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Verifying your email...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
