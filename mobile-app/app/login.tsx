import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/auth-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import {
  colors,
  fontFamily,
  radii,
  spacing,
  typography,
} from "@/theme/tokens";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AUTH_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Email atau password salah.",
  AUTH_ACCOUNT_LOCKED: "Akun terkunci sementara. Coba lagi nanti.",
  AUTH_ACCOUNT_INACTIVE: "Akun tidak aktif. Hubungi manajer toko.",
  FORBIDDEN: "Akun ini belum memiliki akses aplikasi kasir.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu sebentar.",
};

export default function LoginScreen() {
  const { status, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/(app)/dashboard");
  }, [status]);

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    let valid = true;

    if (!trimmedEmail) {
      setEmailError("Email wajib diisi.");
      valid = false;
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError("Format email tidak valid.");
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError("Password wajib diisi.");
      valid = false;
    } else {
      setPasswordError(null);
    }

    if (!valid) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await signIn({ email: trimmedEmail, password, remember });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(AUTH_MESSAGES[error.code] ?? error.message);
      } else {
        setFormError("Terjadi kesalahan. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleForgotPassword() {
    Alert.alert(
      "Lupa sandi?",
      "Hubungi manajer toko untuk mengatur ulang password akun Anda.",
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Ionicons name="storefront" size={22} color={colors.primary} />
              </View>
              <Text style={styles.brand}>POS Kasir</Text>
            </View>
            <Text style={styles.headline}>Masuk ke terminal</Text>
            <Text style={styles.heroCaption}>
              Kelola penjualan dan shift toko dari genggaman Anda.
            </Text>
          </View>

          <View style={styles.card}>
            <TextField
              testID="login-email"
              label="Email"
              icon="mail-outline"
              placeholder="nama@toko.id"
              value={email}
              onChangeText={setEmail}
              error={emailError}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <TextField
              testID="login-password"
              label="Password"
              icon="lock-closed-outline"
              placeholder="Masukkan password"
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              secure
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
            />

            <View style={styles.optionsRow}>
              <Pressable
                testID="login-remember"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
                onPress={() => setRemember((current) => !current)}
                style={styles.rememberRow}
                hitSlop={8}
              >
                <Ionicons
                  name={remember ? "checkbox" : "square-outline"}
                  size={20}
                  color={remember ? colors.primaryContainer : colors.inkMuted}
                />
                <Text style={styles.rememberLabel}>Ingat terminal ini</Text>
              </Pressable>

              <Pressable
                testID="login-forgot"
                accessibilityRole="button"
                onPress={handleForgotPassword}
                hitSlop={8}
              >
                <Text style={styles.forgot}>Lupa sandi?</Text>
              </Pressable>
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <PrimaryButton
              testID="login-submit"
              title="Masuk"
              onPress={handleSubmit}
              loading={submitting}
            />

            <Text style={styles.note}>
              Akses terbatas untuk kasir. Hubungi manajer toko untuk fitur lainnya.
            </Text>
          </View>

          <Text style={styles.version}>Versi 1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primary },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    paddingBottom: spacing.xl,
  },
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radii.control,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontFamily: fontFamily.narrowBold,
    fontSize: 18,
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  headline: {
    marginTop: spacing.md,
    fontFamily: fontFamily.narrowBold,
    fontSize: typography.headlineLgMobile.fontSize,
    lineHeight: typography.headlineLgMobile.lineHeight,
    color: colors.onPrimary,
  },
  heroCaption: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.primaryFixed,
    maxWidth: 300,
  },
  card: {
    marginTop: -24,
    marginHorizontal: spacing.margin,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.hero,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rememberLabel: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.inkSecondary,
  },
  forgot: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.bodyMd.fontSize,
    color: colors.primaryContainer,
  },
  formError: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.control,
    padding: spacing.sm,
  },
  note: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.inkMuted,
    textAlign: "center",
  },
  version: {
    marginTop: spacing.lg,
    textAlign: "center",
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    color: colors.inkMuted,
  },
});
