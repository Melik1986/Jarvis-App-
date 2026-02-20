import React, { useReducer, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Switch,
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
import { useSkillsStore } from "@/store/skillsStore";
import { AppLogger } from "@/lib/logger";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  code: string;
  content: string | null;
  enabled: boolean;
}

type FormState = {
  isAdding: boolean;
  name: string;
  description: string;
  code: string;
  content: string;
};

const initialFormState: FormState = {
  isAdding: false,
  name: "",
  description: "",
  code: "result = { success: true, message: 'Hello from skill' };",
  content: "",
};

function formReducer(prev: FormState, next: Partial<FormState>): FormState {
  return { ...prev, ...next };
}

interface AddSkillFormProps {
  form: FormState;
  updateForm: (next: Partial<FormState>) => void;
  onCancel: () => void;
  onSave: () => void;
  theme: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => string;
}

function AddSkillForm({
  form,
  updateForm,
  onCancel,
  onSave,
  theme,
  t,
}: AddSkillFormProps) {
  return (
    <View style={[styles.form, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText style={styles.formTitle}>{t("newSkill")}</ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholder={t("skillName")}
        placeholderTextColor={theme.textTertiary}
        value={form.name}
        onChangeText={(v) => updateForm({ name: v })}
      />

      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        placeholder={t("description")}
        placeholderTextColor={theme.textTertiary}
        value={form.description}
        onChangeText={(v) => updateForm({ description: v })}
      />

      <ThemedText style={styles.label}>{t("code")}</ThemedText>
      <TextInput
        style={[
          styles.input,
          styles.textArea,
          { color: theme.text, borderColor: theme.border },
        ]}
        multiline
        value={form.code}
        onChangeText={(v) => updateForm({ code: v })}
      />

      {form.content ? (
        <>
          <ThemedText style={styles.label}>
            MD Content ({form.content.length} chars)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.contentArea,
              { color: theme.text, borderColor: theme.border },
            ]}
            multiline
            value={form.content}
            onChangeText={(v) => updateForm({ content: v })}
          />
        </>
      ) : null}

      <View style={styles.formRow}>
        <Button onPress={onCancel} variant="outline">
          {t("cancel")}
        </Button>
        <Button onPress={onSave}>{t("saveSkill")}</Button>
      </View>
    </View>
  );
}

interface SkillCardProps {
  skill: Skill;
  onToggle: (skill: Skill) => void;
  onDelete: (id: string) => void;
  theme: Record<string, string>;
}

function SkillCard({ skill, onToggle, onDelete, theme }: SkillCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.cardName}>{skill.name}</ThemedText>
          <ThemedText style={[styles.cardDesc, { color: theme.textSecondary }]}>
            {skill.description}
          </ThemedText>
        </View>
        <Switch
          value={skill.enabled}
          onValueChange={() => onToggle(skill)}
          trackColor={{ true: theme.primary }}
        />
      </View>

      <View style={styles.cardFooter}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <ThemedText
            style={{
              fontSize: 10,
              color: theme.textTertiary,
              fontFamily: "monospace",
            }}
          >
            ID: {skill.id.split("-")[0]}
          </ThemedText>
          {skill.content ? (
            <View
              style={{
                backgroundColor: "#dbeafe",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <ThemedText
                style={{
                  color: "#1e40af",
                  fontSize: 9,
                  fontWeight: "bold",
                }}
              >
                MD
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => onDelete(skill.id)}>
          <Ionicons name="trash-outline" size={20} color={theme.error} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SkillStoreScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const {
    skills: rawSkills,
    isLoading: loading,
    loadSkills,
    createSkill: storeCreateSkill,
    toggleSkill: storeToggleSkill,
    deleteSkill: storeDeleteSkill,
  } = useSkillsStore();
  const skills: Skill[] = rawSkills.map((s) => ({
    ...s,
    enabled: !!s.enabled,
  }));

  const [form, updateForm] = useReducer(formReducer, initialFormState);

  useEffect(() => {
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUploadMd = async () => {
    let pickerResult;
    try {
      pickerResult = await DocumentPicker.getDocumentAsync({
        type: ["text/markdown", "text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
      });
    } catch (error) {
      AppLogger.error("Failed to pick file:", error);
      return;
    }

    if (pickerResult.canceled || !pickerResult.assets?.length) return;
    const asset = pickerResult.assets[0];
    if (!asset) return;

    const assetName = asset.name ?? "skill";
    const fileName = assetName.replace(/\.[^.]+$/, "");
    const ext = assetName.split(".").pop()?.toLowerCase();

    let text;
    try {
      text = await FileSystem.readAsStringAsync(asset.uri);
    } catch (error) {
      AppLogger.error("Failed to process file:", error);
      return;
    }

    const headingMatch = text.match(/^#\s+(.+)/m);
    const firstLine = headingMatch?.[1] ?? text.split("\n")[0] ?? "";

    if (ext === "js" || ext === "ts") {
      updateForm({
        name: fileName,
        description: firstLine.slice(0, 120),
        code: text,
        content: "",
        isAdding: true,
      });
    } else {
      updateForm({
        name: fileName,
        description: firstLine.slice(0, 120),
        code: "result = { success: true, message: 'Instruction skill' };",
        content: text,
        isAdding: true,
      });
    }
  };

  const resetForm = () => {
    updateForm(initialFormState);
  };

  const handleAddSkill = async () => {
    if (!form.name || (!form.code && !form.content)) {
      Alert.alert(t("error"), t("configurationRequired"));
      return;
    }

    const skillData = {
      name: form.name,
      description: form.description,
      code: form.code || "result = { success: true };",
      content: form.content || undefined,
    };
    try {
      await storeCreateSkill(skillData);
      resetForm();
    } catch (error) {
      AppLogger.error("Failed to add skill:", error);
    }
  };

  const toggleSkill = async (skill: Skill) => {
    try {
      await storeToggleSkill(skill.id);
    } catch (error) {
      AppLogger.error("Failed to toggle skill:", error);
    }
  };

  const deleteSkill = async (id: string) => {
    Alert.alert(t("delete"), t("deleteDocumentConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await storeDeleteSkill(id);
          } catch (error) {
            AppLogger.error("Failed to delete skill:", error);
          }
        },
      },
    ]);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
      >
        <View style={styles.header}>
          <ThemedText style={styles.title}>{t("skillStore")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t("skillStoreDesc")}
          </ThemedText>
        </View>

        {!form.isAdding ? (
          <View style={styles.addRow}>
            <Button
              onPress={() => updateForm({ isAdding: true })}
              variant="outline"
              style={{ flex: 1 }}
            >
              {t("createNewSkill")}
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
          <AddSkillForm
            form={form}
            updateForm={updateForm}
            onCancel={resetForm}
            onSave={handleAddSkill}
            theme={theme}
            t={t}
          />
        )}

        {loading ? null : (
          <View style={styles.list}>
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onToggle={toggleSkill}
                onDelete={deleteSkill}
                theme={theme}
              />
            ))}

            {skills.length === 0 && !form.isAdding && (
              <View style={styles.empty}>
                <ThemedText style={{ color: theme.textTertiary }}>
                  {t("noSkillsYet")}
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
