import React, { useState } from "react";
import { StyleSheet, View, TextInput, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedCheckIcon } from "@/components/AnimatedIcons";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

type APIType = "odata" | "rest" | "graphql";

const apiTypes: { id: APIType; name: string; description: string }[] = [
  { id: "odata", name: "OData", description: "1C, SAP Business One" },
  { id: "rest", name: "REST", description: "Most modern APIs" },
  { id: "graphql", name: "GraphQL", description: "Flexible queries" },
];

export default function ERPSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();

  const { erp, setERPSettings } = useSettingsStore();

  const [erpUrl, setErpUrl] = useState(erp.url);
  const [erpApiKey, setErpApiKey] = useState(erp.apiKey);
  const [specUrl, setSpecUrl] = useState(erp.specUrl);
  const [apiType, setApiType] = useState<APIType>(erp.apiType as APIType);

  const handleSave = () => {
    setERPSettings({
      url: erpUrl,
      apiKey: erpApiKey,
      specUrl,
      apiType,
    });
    navigation.goBack();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.dark.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      <View style={styles.section}>
        <ThemedText style={styles.sectionDescription}>
          Connect to your business system using OpenAPI specification.
        </ThemedText>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>System URL</ThemedText>
          <TextInput
            style={styles.textInput}
            placeholder="https://your-erp.com/api"
            placeholderTextColor={Colors.dark.textTertiary}
            value={erpUrl}
            onChangeText={setErpUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>API Key</ThemedText>
          <TextInput
            style={styles.textInput}
            placeholder="Your ERP API key"
            placeholderTextColor={Colors.dark.textTertiary}
            value={erpApiKey}
            onChangeText={setErpApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>OpenAPI Spec URL</ThemedText>
          <TextInput
            style={styles.textInput}
            placeholder="https://your-erp.com/swagger.json"
            placeholderTextColor={Colors.dark.textTertiary}
            value={specUrl}
            onChangeText={setSpecUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>API Type</ThemedText>

        <View style={styles.typeList}>
          {apiTypes.map((type) => (
            <Pressable
              key={type.id}
              style={[
                styles.typeItem,
                apiType === type.id && styles.typeItemSelected,
              ]}
              onPress={() => setApiType(type.id)}
            >
              <View style={styles.typeContent}>
                <ThemedText style={styles.typeName}>{type.name}</ThemedText>
                <ThemedText style={styles.typeDescription}>{type.description}</ThemedText>
              </View>
              {apiType === type.id ? (
                <View style={styles.checkCircle}>
                  <AnimatedCheckIcon size={16} color={Colors.dark.buttonText} />
                </View>
              ) : (
                <View style={styles.emptyCircle} />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button onPress={handleSave}>Save Settings</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["3xl"],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.dark.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.lg,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.dark.text,
  },
  typeList: {
    gap: Spacing.sm,
  },
  typeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  typeItemSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primary + "10",
  },
  typeContent: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  typeDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.textTertiary,
  },
  buttonContainer: {
    marginTop: Spacing.lg,
  },
});
