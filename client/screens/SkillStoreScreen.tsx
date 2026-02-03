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

interface Skill {
  id: string;
  name: string;
  description: string;
  code: string;
  enabled: boolean;
}

export default function SkillStoreScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState(
    "result = { success: true, message: 'Hello from skill' };",
  );

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", "/api/skills");
      if (response.ok) {
        const data = await response.json();
        setSkills(data);
      }
    } catch (error) {
      AppLogger.error("Failed to fetch skills:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleAddSkill = async () => {
    if (!name || !code) {
      Alert.alert("Error", "Name and code are required");
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/skills", {
        name,
        description,
        code,
        enabled: true,
      });

      if (response.ok) {
        setIsAdding(false);
        setName("");
        setDescription("");
        fetchSkills();
      }
    } catch (error) {
      AppLogger.error("Failed to add skill:", error);
    }
  };

  const toggleSkill = async (skill: Skill) => {
    try {
      const response = await apiRequest("PUT", `/api/skills/${skill.id}`, {
        enabled: !skill.enabled,
      });
      if (response.ok) {
        fetchSkills();
      }
    } catch (error) {
      AppLogger.error("Failed to toggle skill:", error);
    }
  };

  const deleteSkill = async (id: string) => {
    Alert.alert("Delete", "Delete this skill?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await apiRequest("DELETE", `/api/skills/${id}`);
          fetchSkills();
        },
      },
    ]);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>Skill Store</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Custom scripts and tools for your agent
          </ThemedText>
        </View>

        {!isAdding ? (
          <Button
            onPress={() => setIsAdding(true)}
            variant="outline"
            style={styles.addBtn}
          >
            Create New Skill
          </Button>
        ) : (
          <View
            style={[
              styles.form,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText style={styles.formTitle}>New Skill</ThemedText>

            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Skill Name"
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

            <ThemedText style={styles.label}>JavaScript Code</ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { color: theme.text, borderColor: theme.border },
              ]}
              multiline
              value={code}
              onChangeText={setCode}
            />

            <View style={styles.formRow}>
              <Button onPress={() => setIsAdding(false)} variant="outline">
                Cancel
              </Button>
              <Button onPress={handleAddSkill}>Save Skill</Button>
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
          <View style={styles.list}>
            {skills.map((skill) => (
              <View
                key={skill.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardName}>
                      {skill.name}
                    </ThemedText>
                    <ThemedText
                      style={[styles.cardDesc, { color: theme.textSecondary }]}
                    >
                      {skill.description}
                    </ThemedText>
                  </View>
                  <Switch
                    value={skill.enabled}
                    onValueChange={() => toggleSkill(skill)}
                    trackColor={{ true: theme.primary }}
                  />
                </View>

                <View style={styles.cardFooter}>
                  <ThemedText
                    style={{
                      fontSize: 10,
                      color: theme.textTertiary,
                      fontFamily: "monospace",
                    }}
                  >
                    ID: {skill.id.split("-")[0]}
                  </ThemedText>
                  <Pressable onPress={() => deleteSkill(skill.id)}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={theme.error}
                    />
                  </Pressable>
                </View>
              </View>
            ))}

            {skills.length === 0 && !isAdding && (
              <View style={styles.empty}>
                <ThemedText style={{ color: theme.textTertiary }}>
                  No custom skills yet.
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
    fontSize: 12,
    fontWeight: "bold",
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    fontFamily: "monospace",
    fontSize: 12,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  list: {
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cardDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  empty: {
    alignItems: "center",
    marginTop: 40,
  },
});
