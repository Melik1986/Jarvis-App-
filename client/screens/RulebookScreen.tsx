import React, { useReducer, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useRulesStore } from "@/store/rulesStore";
import { localVectorStore } from "@/lib/local-rag/vector-store";
import { AppLogger } from "@/lib/logger";
import type { LocalRule } from "@/lib/local-store";
import type { LocalDocument } from "@/lib/local-rag/vector-store";

type Rule = Omit<LocalRule, "enabled"> & { enabled: boolean };
type Document = LocalDocument;

type ScreenState = {
  documents: Document[];
  isAdding: boolean;
  name: string;
  description: string;
  condition: string;
  action: "reject" | "warn" | "require_confirmation";
  message: string;
  content: string;
};

const initialState: ScreenState = {
  documents: [],
  isAdding: false,
  name: "",
  description: "",
  condition:
    '{"tool": "create_invoice", "field": "quantity", "operator": "<", "value": 0}',
  action: "reject",
  message: "Quantity cannot be negative",
  content: "",
};

function screenReducer(
  prev: ScreenState,
  next: Partial<ScreenState>,
): ScreenState {
  return { ...prev, ...next };
}

async function fetchRulebookData(
  loadRules: () => Promise<void>,
  setDocuments: (docs: Document[]) => void,
) {
  await loadRules();
  try {
    const docs = await localVectorStore.listAll();
    setDocuments(docs);
  } catch (error) {
    AppLogger.error("Failed to fetch docs:", error);
  }
}

type AddRuleFormProps = {
  state: ScreenState;
  update: (next: Partial<ScreenState>) => void;
  theme: ReturnType<typeof useTheme>["theme"];
  t: ReturnType<typeof useTranslation>["t"];
  onSave: () => void;
  onCancel: () => void;
};

function AddRuleForm({
  state,
  update,
  theme,
  t,
  onSave,
  onCancel,
}: AddRuleFormProps) {
  return (
    <View style={[styles.form, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText style={styles.formTitle}>{t("newRule")}</ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholder={t("ruleNamePlaceholder")}
        placeholderTextColor={theme.textTertiary}
        value={state.name}
        onChangeText={(v) => update({ name: v })}
      />

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholder={t("description")}
        placeholderTextColor={theme.textTertiary}
        value={state.description}
        onChangeText={(v) => update({ description: v })}
      />

      <ThemedText style={styles.label}>{t("action")}</ThemedText>
      <View style={styles.actionRow}>
        {(["reject", "warn", "require_confirmation"] as const).map((a) => (
          <Pressable
            key={a}
            onPress={() => update({ action: a })}
            style={[
              styles.actionChip,
              {
                backgroundColor:
                  state.action === a ? theme.primary : theme.backgroundTertiary,
              },
            ]}
          >
            <ThemedText
              style={{
                color: state.action === a ? theme.buttonText : theme.text,
                fontSize: 12,
              }}
            >
              {a.replace("_", " ")}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={styles.label}>{t("messageToUser")}</ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholder={t("messagePlaceholder")}
        placeholderTextColor={theme.textTertiary}
        value={state.message}
        onChangeText={(v) => update({ message: v })}
      />

      <ThemedText style={styles.label}>{t("conditionJson")}</ThemedText>
      <TextInput
        style={[
          styles.input,
          styles.textArea,
          { color: theme.text, borderColor: theme.border },
        ]}
        multiline
        value={state.condition}
        onChangeText={(v) => update({ condition: v })}
      />

      {state.content ? (
        <>
          <ThemedText style={styles.label}>
            MD Content ({state.content.length} chars)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.contentArea,
              { color: theme.text, borderColor: theme.border },
            ]}
            multiline
            value={state.content}
            onChangeText={(v) => update({ content: v })}
          />
        </>
      ) : null}

      <View style={styles.formRow}>
        <Button onPress={onCancel} variant="outline">
          {t("cancel")}
        </Button>
        <Button onPress={onSave}>{t("saveRule")}</Button>
      </View>
    </View>
  );
}

type RuleCardProps = {
  rule: Rule;
  theme: ReturnType<typeof useTheme>["theme"];
  onToggle: (rule: Rule) => void;
  onDelete: (id: string) => void;
};

function RuleCard({ rule, theme, onToggle, onDelete }: RuleCardProps) {
  return (
    <View
      style={[styles.ruleCard, { backgroundColor: theme.backgroundSecondary }]}
    >
      <View style={styles.ruleHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.ruleName}>{rule.name}</ThemedText>
          <ThemedText style={[styles.ruleDesc, { color: theme.textSecondary }]}>
            {rule.description}
          </ThemedText>
        </View>
        <Switch
          value={rule.enabled}
          onValueChange={() => onToggle(rule)}
          trackColor={{ true: theme.primary }}
        />
      </View>

      <View style={styles.ruleMeta}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  rule.action === "reject" ? "#fee2e2" : "#fef3c7",
              },
            ]}
          >
            <ThemedText
              style={{
                color: rule.action === "reject" ? "#991b1b" : "#92400e",
                fontSize: 12,
                fontWeight: "bold",
              }}
            >
              {rule.action.toUpperCase()}
            </ThemedText>
          </View>
          {rule.content ? (
            <View style={[styles.badge, { backgroundColor: "#dbeafe" }]}>
              <ThemedText
                style={{
                  color: "#1e40af",
                  fontSize: 10,
                  fontWeight: "bold",
                }}
              >
                MD
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => onDelete(rule.id)}>
          <Ionicons name="trash-outline" size={20} color={theme.error} />
        </Pressable>
      </View>
    </View>
  );
}

export default function RulebookScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { rules: rawRules, isLoading: loading, loadRules } = useRulesStore();
  const rules: Rule[] = rawRules.map((r) => ({ ...r, enabled: !!r.enabled }));
  const [state, update] = useReducer(screenReducer, initialState);

  useEffect(() => {
    fetchRulebookData(loadRules, (docs) => update({ documents: docs }));
  }, [loadRules]);

  const {
    createRule: storeCreateRule,
    toggleRule: storeToggleRule,
    deleteRule: storeDeleteRule,
  } = useRulesStore();

  const handleUploadMd = async () => {
    let pickerResult;
    try {
      pickerResult = await DocumentPicker.getDocumentAsync({
        type: ["text/markdown", "text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
      });
    } catch (error) {
      AppLogger.error("Failed to pick MD file:", error);
      return;
    }

    if (pickerResult.canceled || !pickerResult.assets?.length) return;
    const asset = pickerResult.assets[0];
    if (!asset) return;

    const assetName = asset.name ?? "rule";
    const fileName = assetName.replace(/\.[^.]+$/, "");

    let text;
    try {
      text = await FileSystem.readAsStringAsync(asset.uri);
    } catch (error) {
      AppLogger.error("Failed to process MD file:", error);
      return;
    }

    const headingMatch = text.match(/^#\s+(.+)/m);
    const firstLine = headingMatch?.[1] ?? text.split("\n")[0] ?? "";

    update({
      name: fileName,
      description: firstLine.slice(0, 120),
      condition: "{}",
      action: "warn",
      message: "",
      content: text,
      isAdding: true,
    });
  };

  const resetForm = () => {
    update({
      isAdding: false,
      name: "",
      description: "",
      content: "",
      condition:
        '{"tool": "create_invoice", "field": "quantity", "operator": "<", "value": 0}',
      action: "reject",
      message: "Quantity cannot be negative",
    });
  };

  const handleAddRule = async () => {
    if (!state.name || (!state.condition && !state.content)) {
      Alert.alert(t("error"), t("configurationRequired"));
      return;
    }

    const ruleData = {
      name: state.name,
      description: state.description,
      condition: state.condition || "{}",
      action: state.action,
      message: state.message,
      content: state.content || undefined,
    };
    try {
      await storeCreateRule(ruleData);
      resetForm();
    } catch (error) {
      AppLogger.error("Failed to add rule:", error);
      Alert.alert(t("error"), "Failed to save rule");
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      await storeToggleRule(rule.id);
    } catch (error) {
      AppLogger.error("Failed to toggle rule:", error);
    }
  };

  const deleteRule = async (id: string) => {
    Alert.alert(t("delete"), t("deleteRuleConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await storeDeleteRule(id);
          } catch (error) {
            AppLogger.error("Failed to delete rule:", error);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>{t("agentRules")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t("agentRulesDesc")}
          </ThemedText>
        </View>

        {!state.isAdding ? (
          <View style={styles.addRow}>
            <Button
              onPress={() => update({ isAdding: true })}
              variant="outline"
              style={{ flex: 1 }}
            >
              {t("addNewRule")}
            </Button>
            <Pressable
              onPress={handleUploadMd}
              style={[
                styles.uploadBtn,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Ionicons
                name="document-attach"
                size={20}
                color={theme.primary}
              />
              <ThemedText style={{ fontSize: 12, color: theme.primary }}>
                .md
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <AddRuleForm
            state={state}
            update={update}
            theme={theme}
            t={t}
            onSave={handleAddRule}
            onCancel={resetForm}
          />
        )}

        {loading ? null : (
          <View style={styles.ruleList}>
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                theme={theme}
                onToggle={toggleRule}
                onDelete={deleteRule}
              />
            ))}

            {rules.length === 0 && !state.isAdding && (
              <View style={styles.empty}>
                <ThemedText style={{ color: theme.textTertiary }}>
                  {t("noRulesYet")}
                </ThemedText>
              </View>
            )}

            {state.documents.length > 0 && (
              <View style={{ marginTop: Spacing.xl }}>
                <ThemedText
                  type="h4"
                  style={{
                    marginBottom: Spacing.md,
                    paddingHorizontal: Spacing.xs,
                  }}
                >
                  {t("documents")}
                </ThemedText>
                {state.documents.map((doc) => (
                  <View
                    key={doc.id}
                    style={[
                      styles.ruleCard,
                      {
                        backgroundColor: theme.backgroundSecondary,
                        opacity: 0.8,
                      },
                    ]}
                  >
                    <View style={styles.ruleHeader}>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={16}
                            color={theme.text}
                          />
                          <ThemedText style={styles.ruleName}>
                            {doc.name}
                          </ThemedText>
                        </View>
                        <ThemedText
                          style={[
                            styles.ruleDesc,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {((doc.metadata as Record<string, unknown>)
                            ?.type as string) ?? "document"}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  addRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  form: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    fontFamily: "monospace",
  },
  contentArea: {
    height: 140,
    textAlignVertical: "top",
    fontFamily: "monospace",
    fontSize: 12,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  ruleList: {
    padding: Spacing.lg,
  },
  ruleCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  ruleHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  ruleName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  ruleDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  ruleMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
});
