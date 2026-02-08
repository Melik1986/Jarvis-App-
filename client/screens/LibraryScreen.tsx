import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";
import { AnimatedSearchIcon } from "@/components/AnimatedIcons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AppLogger } from "@/lib/logger";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "txt" | "docx" | "xlsx" | "other";
  size: string;
  uploadedAt: Date;
  status: "indexed" | "processing" | "error";
}

type FormDataFile = {
  uri: string;
  type: string;
  name: string;
};

const DocumentTypeIcon = ({
  type,
  size,
  color,
}: {
  type: string;
  size: number;
  color: string;
}) => {
  return <Ionicons name="document-text-outline" size={size} color={color} />;
};

function PlusIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({
  size = 20,
  color,
  backgroundColor,
}: {
  size?: number;
  color: string;
  backgroundColor: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} />
      <Path
        d="M15 9l-6 6M9 9l6 6"
        stroke={backgroundColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function LibraryScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp<LibraryStackParamList>>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const getAccessToken = useAuthStore((state) => state.getAccessToken);
  const llmSettings = useSettingsStore((state) => state.llm);
  const ragSettings = useSettingsStore((state) => state.rag);

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: DocumentPicker.DocumentPickerAsset) => {
      const formData = new FormData();

      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append("file", blob, file.name);
      } else {
        const filePart: FormDataFile = {
          uri: file.uri,
          type: file.mimeType || "application/octet-stream",
          name: file.name,
        };
        formData.append("file", filePart as unknown as Blob);
      }
      formData.append("name", file.name);

      // Pass RAG + LLM settings for embedding generation (BYO-LLM)
      const ragUploadSettings: Record<string, unknown> = {
        provider: ragSettings.provider,
        qdrant: ragSettings.qdrant,
        openaiApiKey: llmSettings.apiKey,
        openaiBaseUrl: llmSettings.baseUrl,
      };
      formData.append("ragSettings", JSON.stringify(ragUploadSettings));

      const headers: Record<string, string> = {};
      const token = getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        new URL("/api/documents/upload", getApiUrl()).toString(),
        {
          method: "POST",
          headers,
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        AppLogger.error("Upload error:", errorText);
        let userMsg = t("uploadFailed");
        try {
          const parsed = JSON.parse(errorText);
          userMsg = parsed.details
            ? `${parsed.message}: ${parsed.details}`
            : parsed.message || userMsg;
        } catch {
          /* non-JSON */
        }
        throw new Error(userMsg);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      Alert.alert(t("success"), t("documentReindexed"));
    },
    onError: (error: Error) => {
      Alert.alert(t("error"), error.message || t("uploadFailed"));
      AppLogger.error("Upload mutation error:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const seedDemoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/documents/seed-demo");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (data.created > 0) {
        Alert.alert("Success", `${data.created} demo documents added`);
      } else {
        Alert.alert("Info", "Demo documents already exist");
      }
    },
    onError: () => {
      Alert.alert(t("error"), "Failed to add demo documents");
    },
  });

  const handleSeedDemo = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    seedDemoMutation.mutate();
  };

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    return documents.filter((doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [documents, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleUploadDocument = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        uploadMutation.mutate(file);
      }
    } catch (error) {
      AppLogger.error("Document picker error:", error);
    }
  };

  const handleDeleteDocument = (docId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Alert.alert(t("confirmDelete"), t("deleteDocumentConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate(docId);
        },
      },
    ]);
  };

  const getStatusColor = (status: Document["status"]) => {
    switch (status) {
      case "indexed":
        return theme.success;
      case "processing":
        return theme.warning;
      case "error":
        return theme.error;
      default:
        return theme.textTertiary;
    }
  };

  const getStatusText = (status: Document["status"]) => {
    switch (status) {
      case "indexed":
        return t("indexed");
      case "processing":
        return t("processing");
      case "error":
        return t("error");
      default:
        return "";
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - dateObj.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("justNow");
    if (hours < 1) return `${minutes}m`;
    if (days < 1) return `${hours}${t("hoursAgo")}`;
    return `${days}${t("daysAgo")}`;
  };

  const handleDocumentPress = (item: Document) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("DocumentViewer", {
      documentId: item.id,
      documentName: item.name,
    });
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <Pressable
      style={({ pressed }) => [
        styles.documentCard,
        { backgroundColor: theme.backgroundDefault },
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => handleDocumentPress(item)}
    >
      <View style={styles.documentIcon}>
        <DocumentTypeIcon type={item.type} size={32} color={theme.primary} />
      </View>
      <View style={styles.documentContent}>
        <ThemedText
          type="body"
          style={[styles.documentName, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.name}
        </ThemedText>
        <View style={styles.documentMeta}>
          <ThemedText
            style={[styles.documentSize, { color: theme.textSecondary }]}
          >
            {item.size}
          </ThemedText>
          <ThemedText
            style={[styles.documentDate, { color: theme.textTertiary }]}
          >
            {formatDate(item.uploadedAt)}
          </ThemedText>
        </View>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <ThemedText
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {getStatusText(item.status)}
          </ThemedText>
        </View>
      </View>
      <Pressable
        style={styles.deleteButton}
        onPress={() => handleDeleteDocument(item.id)}
        hitSlop={8}
      >
        <TrashIcon size={20} color={theme.textTertiary} />
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[styles.headerSection, { marginTop: headerHeight + Spacing.lg }]}
      >
        <View style={styles.titleRow}>
          <ThemedText type="h2" style={{ color: theme.text }}>
            {t("knowledgeBase")}
          </ThemedText>
          <Pressable
            style={[styles.uploadButton, { backgroundColor: theme.primary }]}
            onPress={handleUploadDocument}
          >
            <PlusIcon size={20} color="#FFFFFF" />
            <ThemedText style={styles.uploadButtonText}>
              {t("uploadDocument")}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t("ragLibraryDesc")}
        </ThemedText>

        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <AnimatedSearchIcon size={20} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t("searchDocuments")}
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => handleSearch("")}>
              <CloseIcon
                size={20}
                color={theme.textTertiary}
                backgroundColor={theme.backgroundRoot}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredDocuments}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={120}
              color={theme.textTertiary}
              style={{ marginBottom: Spacing.lg, opacity: 0.5 }}
            />
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              {t("emptyLibrary")}
            </ThemedText>
            <ThemedText
              style={{ color: theme.textSecondary, marginBottom: Spacing.xl }}
            >
              {t("uploadDocsHint")}
            </ThemedText>
            <View style={styles.demoButtonContainer}>
              <Pressable
                style={[
                  styles.demoButton,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
                onPress={handleSeedDemo}
                disabled={seedDemoMutation.isPending}
              >
                <ThemedText
                  style={[styles.demoButtonText, { color: theme.primary }]}
                >
                  {seedDemoMutation.isPending ? "Loading..." : "Add Demo Data"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.select({ ios: Spacing.sm, android: Spacing.xs }),
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  documentIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentName: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  documentMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  documentSize: {
    fontSize: 12,
  },
  documentDate: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  demoButtonContainer: {
    alignItems: "center",
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  demoButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
