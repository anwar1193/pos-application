import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth/auth-context";
import { ScreenState } from "@/components/ScreenState";

export default function AppLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return <ScreenState variant="loading" message="Memulihkan sesi..." />;
  }

  if (status !== "authenticated") {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}