import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { AppLogger } from "@/lib/logger";

interface Rule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  message: string;
  enabled: boolean;
}

export default function RulebookScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // New rule form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState(
    '{"tool": "create_invoice", "field": "quantity", "operator": "<", "value": 0}',
  );
  const [action, setAction] = useState<
    "reject" | "warn" | "require_confirmation"
  >("reject");
  const [message, setMessage] = useState("Quantity cannot be negative");

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/rules");
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      AppLogger.error("Failed to fetch rules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRule = async () => {
    if (!name || !condition) {
      Alert.alert("Error", "Name and condition are required");
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/rules", {
        name,
        description,
        condition,
        action,
        message,
        enabled: true,
      });

      if (response.ok) {
        setIsAdding(false);
        setName("");
        setDescription("");
        fetchRules();
      }
    } catch (error) {
      AppLogger.error("Failed to add rule:", error);
      Alert.alert("Error", "Failed to save rule");
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      const response = await apiRequest("PUT", `/api/rules/${rule.id}`, {
        enabled: !rule.enabled,
      });
      if (response.ok) {
        fetchRules();
      }
    } catch (error) {
      AppLogger.error("Failed to toggle rule:", error);
    }
  };

  const deleteRule = async (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this rule?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await apiRequest("DELETE", `/api/rules/${id}`);
              if (response.ok) {
                fetchRules();
              }
            } catch (error) {
              AppLogger.error("Failed to delete rule:", error);
            }
          },
        },
      ],
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Agent Rules</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Define constraints for your AI agent
          </ThemedText>
        </View>

        {!isAdding ? (
          <Button
            onPress={() => setIsAdding(true)}
            variant="outline"
            style={styles.addBtn}
          >
            Add New Rule
          </Button>
        ) : (
          <View
            style={[
              styles.form,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText style={styles.formTitle}>New Rule</ThemedText>

            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Rule Name (e.g. Prevent Negative Quantity)"
              placeholderTextColor={theme.textTertiary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Description"
              placeholderTextColor={theme.textTertiary}
              value={description}
              onChangeText={setDescription}
            />

            <ThemedText style={styles.label}>Action</ThemedText>
            <View style={styles.actionRow}>
              {(["reject", "warn", "require_confirmation"] as const).map(
                (a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAction(a)}
                    style={[
                      styles.actionChip,
                      {
                        backgroundColor:
                          action === a
                            ? theme.primary
                            : theme.backgroundTertiary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: action === a ? theme.buttonText : theme.text,
                        fontSize: 12,
                      }}
                    >
                      {a.replace("_", " ")}
                    </ThemedText>
                  </Pressable>
                ),
              )}
            </View>

            <ThemedText style={styles.label}>Message to User</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="e.g. Total amount exceeds limit"
              placeholderTextColor={theme.textTertiary}
              value={message}
              onChangeText={setMessage}
            />

            <ThemedText style={styles.label}>Condition (JSON)</ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { color: theme.text, borderColor: theme.border },
              ]}
              multiline
              value={condition}
              onChangeText={setCondition}
            />

            <View style={styles.formRow}>
              <Button onPress={() => setIsAdding(false)} variant="outline">
                Cancel
              </Button>
              <Button onPress={handleAddRule}>Save Rule</Button>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.primary}
            style={{ marginTop: 20 }}
          />
        ) : (
          <View style={styles.ruleList}>
            {rules.map((rule) => (
              <View
                key={rule.id}
                style={[
                  styles.ruleCard,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <View style={styles.ruleHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.ruleName}>{rule.name}</ThemedText>
                    <ThemedText
                      style={[styles.ruleDesc, { color: theme.textSecondary }]}
                    >
                      {rule.description}
                    </ThemedText>
                  </View>
                  <Switch
                    value={rule.enabled}
                    onValueChange={() => toggleRule(rule)}
                    trackColor={{ true: theme.primary }}
                  />
                </View>

                <View style={styles.ruleMeta}>
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
                  <Pressable onPress={() => deleteRule(rule.id)}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={theme.error}
                    />
                  </Pressable>
                </View>
              </View>
            ))}

            {rules.length === 0 && !isAdding && (
              <View style={styles.empty}>
                <ThemedText style={{ color: theme.textTertiary }}>
                  No rules defined yet.
                </ThemedText>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
  addBtn: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
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
