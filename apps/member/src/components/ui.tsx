// Minimal shared UI primitives for the member app shell. (A full cross-app design system
// lives in packages/ui — Phase 1B follow-up; kept local here to keep the shell self-contained.)
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  bg: "#0B0B0F",
  text: "#F2F2F5",
  muted: "#9A9AA5",
  brand: "#208AEF",
  card: "#16161D",
  border: "#26263140",
};

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}) {
  const isSecondary = variant === "secondary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isSecondary && styles.buttonSecondary,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? COLORS.text : "#fff"} />
      ) : (
        <Text style={[styles.buttonText, isSecondary && styles.buttonTextSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: 20, gap: 16, maxWidth: 480, width: "100%", alignSelf: "center" },
  heading: { color: COLORS.text, fontSize: 28, fontWeight: "700" },
  body: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  field: { gap: 6 },
  label: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.border },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  buttonTextSecondary: { color: COLORS.text },
  choice: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.card,
  },
  choiceSelected: { borderColor: COLORS.brand, backgroundColor: "#208AEF22" },
  choiceText: { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  choiceTextSelected: { color: COLORS.brand },
});
