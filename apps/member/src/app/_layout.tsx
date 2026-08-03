import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0B0B0F" },
          headerTintColor: "#F2F2F5",
          contentStyle: { backgroundColor: "#0B0B0F" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "FluoFit" }} />
        <Stack.Screen name="checkout" options={{ title: "Pretplata" }} />
        <Stack.Screen name="activate" options={{ title: "Aktiviraj Box" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
