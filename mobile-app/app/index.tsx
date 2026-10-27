import { Redirect } from "expo-router";
import { useAuth } from "@/auth/auth-context";
import { ScreenState } from "@/components/ScreenState";

export default function IndexScreen() {
  const { status } = useAuth();

  if (status === "loading") {
    return <ScreenState variant="loading" message="Menyiapkan terminal..." />;
  }

  return (
    <Redirect href={status === "authenticated" ? "/(app)/dashboard" : "/login"} />
  );
}