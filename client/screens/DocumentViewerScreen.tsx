import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useRoute,
  useNavigation,
  RouteProp,
  NavigationProp,
} from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";

type DocumentViewerRouteProp = RouteProp<
  LibraryStackParamList,
  "DocumentViewer"
>;

interface DocumentMetadata {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: string;
  status: string;
  chunkCount?: number;
  errorMessage?: string;
}

export default function DocumentViewerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<DocumentViewerRouteProp>();
  const navigation = useNavigation<NavigationProp<LibraryStackParamList>>();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { documentId, documentName } = route.params;

  const { data: document, isLoading: loadingDoc } = useQuery<DocumentMetadata>({
    queryKey: ["/api/documents", documentId],
    queryFn: async () => {
      const response = await fetch(
        new URL(`/api/documents/${documentId}`, getApiUrl()).toString(),
      );
      if (!response.ok) throw new Error("Failed to fetch document");
      return response.json();
    },
  });

  const { data: contentData, isLoading: loadingContent } = useQuery<{
    id: string;
    content: string;
  }>({
    queryKey: ["/api/documents", documentId, "content"],
    queryFn: async () => {
      const response = await fetch(
        new URL(`/api/documents/${documentId}/content`, getApiUrl()).toString(),
      );
      if (!response.ok) throw new Error("Failed to fetch content");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      navigation.goBack();
    },
  });

  const reindexMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/documents/${documentId}/reindex`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/documents", documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      Alert.alert(
        t("success") || "Success",
        t("documentReindexed") || "Document reindexed successfully",
      );
    },
  });

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("deleteDocument") || "Delete Document",
      t("deleteDocumentConfirm") ||
        "Are you sure you want to delete this document?",
      [
        { text: t("cancel") || "Cancel", style: "cancel" },
        {
          text: t("delete") || "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  const handleReindex = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reindexMutation.mutate();
  };

  const isLoading = loadingDoc || loadingContent;

  const formatDate = (dateInput: string | Date) => {
    const date =
      typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "indexed":
        return theme.success;
      case "processing":
        return theme.warning;
      case "error":
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "indexed":
        return t("indexed") || "Indexed";
      case "processing":
        return t("processing") || "Processing";
      case "error":
        return t("error") || "Error";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View
        style={[
          styles.metadataCard,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("name") || "Name"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {document?.name || documentName}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("type") || "Type"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {document?.type || "Unknown"}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("size") || "Size"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {document?.size || "Unknown"}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("status") || "Status"}
          </ThemedText>
          <ThemedText
            style={[
              styles.metadataValue,
              { color: getStatusColor(document?.status || "") },
            ]}
          >
            {getStatusText(document?.status || "")}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("chunks") || "Chunks"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {document?.chunkCount || 0}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("uploaded") || "Uploaded"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {document?.uploadedAt ? formatDate(document.uploadedAt) : "Unknown"}
          </ThemedText>
        </View>

        {document?.errorMessage ? (
          <View style={styles.metadataRow}>
            <ThemedText style={[styles.metadataLabel, { color: theme.error }]}>
              {t("error") || "Error"}
            </ThemedText>
            <ThemedText style={[styles.metadataValue, { color: theme.error }]}>
              {document.errorMessage}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={handleReindex}
          disabled={reindexMutation.isPending}
        >
          <Feather name="refresh-cw" size={18} color="#fff" />
          <ThemedText style={styles.actionButtonText}>
            {reindexMutation.isPending
              ? t("processing") || "Processing..."
              : t("reindex") || "Reindex"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.error }]}
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Feather name="trash-2" size={18} color="#fff" />
          <ThemedText style={styles.actionButtonText}>
            {t("delete") || "Delete"}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.contentSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {t("documentContent") || "Document Content"}
        </ThemedText>
        <View
          style={[
            styles.contentBox,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ScrollView nestedScrollEnabled style={styles.contentScroll}>
            <ThemedText style={[styles.contentText, { color: theme.text }]}>
              {contentData?.content || t("noContent") || "No content available"}
            </ThemedText>
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  metadataCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: Spacing.md,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  contentSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  contentBox: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 300,
    maxHeight: 500,
  },
  contentScroll: {
    flex: 1,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
  },
});
