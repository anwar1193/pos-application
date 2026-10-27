import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, fontFamily, radii, spacing, typography } from "@/theme/tokens";

type TextFieldProps = TextInputProps & {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  secure?: boolean;
};

export function TextField({
  label,
  icon,
  error,
  secure = false,
  testID,
  ...inputProps
}: TextFieldProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.inkMuted} />
        ) : null}
        <TextInput
          {...inputProps}
          testID={testID}
          style={styles.input}
          placeholderTextColor={colors.inkMuted}
          secureTextEntry={secure ? hidden : false}
        />
        {secure ? (
          <Pressable
            testID={testID ? `${testID}-toggle` : undefined}
            onPress={() => setHidden((current) => !current)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Tampilkan password" : "Sembunyikan password"}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={colors.inkMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: {
    fontFamily: fontFamily.narrowSemiBold,
    fontSize: typography.labelMd.fontSize,
    lineHeight: typography.labelMd.lineHeight,
    color: colors.inkSecondary,
  },
  field: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radii.control,
  },
  fieldError: { borderColor: colors.danger },
  input: {
    flex: 1,
    minHeight: 46,
    fontFamily: fontFamily.narrow,
    fontSize: 16,
    color: colors.inkPrimary,
    paddingVertical: 0,
  },
  error: {
    fontFamily: fontFamily.narrow,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    color: colors.danger,
  },
});
