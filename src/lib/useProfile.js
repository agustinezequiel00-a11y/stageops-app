import { useEffect, useState } from "react";
import { hasSupabase, supabase } from "./supabase";

export function useProfile(session) {
  const [profile, setProfile] = useState(
    !hasSupabase ? { role: "owner", full_name: "Demo", organization_id: "demo" } : null
  );
  const [loading, setLoading] = useState(hasSupabase);

  useEffect(() => {
    if (!hasSupabase || !session?.user?.id) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, role, full_name, organization_id")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && error.code !== "PGRST116") console.error("No se pudo cargar el perfil:", error.message);
        setProfile(data || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  return { profile, loading, isOwner: profile?.role === "owner" };
}
