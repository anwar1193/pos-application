import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

type ScreenStateProps =
  | { variant: "loading"; message?: string }
  | {
      variant: "error";
      message?: string;
      onRetry: () => void;
      onSignOut?: () => void;
    };

export function ScreenState(props: ScreenStateProps) {
  if (props.variant === "loading") {
    return (
      <View style={styles.container} testID="screen-loading">
        <ActivityIndicator color={colors.primaryContainer} size="large" />
        <Text style={styles.message}>{props.message ?? "Memuat ringkasan toko..."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="screen-error">
      <Text style={styles.errorTitle}>Gagal memuat data</Text>
      <Text style={styles.message}>
        {props.message ?? "Periksa koneksi Anda lalu coba lagi."}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={props.onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <Text style={styles.retryText}>Coba Lagi</Text>
      </Pressable>

      {props.onSignOut ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
        >
          <Text style={styles.signOutText}>Keluar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  errorTitle: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.headlineSm.fontSize,
    lineHeight: typography.headlineSm.lineHeight,
    color: colors.inkPrimary,
  },
  message: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodyMd.fontSize,
    lineHeight: typography.bodyMd.lineHeight,
    color: colors.inkSecondary,
    textAlign: "center",
  },
  retry: {
    minHeight: 48,
    minWidth: 140,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.control,
    backgroundColor: colors.primaryContainer,
  },
  retryPressed: { backgroundColor: colors.primaryPressed },
  retryText: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelLg.fontSize,
    color: colors.onPrimary,
  },
  signOut: {
    minHeight: 48,
    minWidth: 140,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceLowest,
  },
  signOutPressed: { backgroundColor: colors.surfaceLow },
  signOutText: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelLg.fontSize,
    color: colors.inkPrimary,
  },
});
