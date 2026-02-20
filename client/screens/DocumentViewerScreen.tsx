import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useRoute,
  useNavigation,
  RouteProp,
  NavigationProp,
} from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";
import { LibraryStackParamList } from "@/navigation/LibraryStackNavigator";
import {
  localVectorStore,
  type LocalDocument,
} from "@/lib/local-rag/vector-store";
import { AppLogger } from "@/lib/logger";

type DocumentViewerRouteProp = RouteProp<
  LibraryStackParamList,
  "DocumentViewer"
>;

type LocalDocumentMetadata = {
  type: string;
  size: number;
  chunks: number;
};

function asLocalMetadata(
  raw: LocalDocument["metadata"],
): LocalDocumentMetadata {
  const type = typeof raw.type === "string" ? raw.type : "other";
  const sizeRaw = raw.size;
  const chunksRaw = raw.chunks;
  const size =
    typeof sizeRaw === "number" && Number.isFinite(sizeRaw) ? sizeRaw : 0;
  const chunks =
    typeof chunksRaw === "number" && Number.isFinite(chunksRaw) ? chunksRaw : 0;
  return { type, size, chunks };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentViewerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<DocumentViewerRouteProp>();
  const navigation = useNavigation<NavigationProp<LibraryStackParamList>>();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { documentId, documentName } = route.params;
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      const doc = await localVectorStore.getDocument(documentId);
      setDocument(doc);
    } catch (error) {
      AppLogger.error("Failed to load local document:", error);
      setDocument(null);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const metadata = useMemo(() => {
    if (!document) return asLocalMetadata({});
    const parsed = asLocalMetadata(document.metadata);
    return {
      ...parsed,
      size: parsed.size > 0 ? parsed.size : document.content.length,
    };
  }, [document]);

  const handleDelete = useCallback(() => {
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
          onPress: async () => {
            await localVectorStore.deleteDocument(documentId);
            navigation.goBack();
          },
        },
      ],
    );
  }, [documentId, navigation, t]);

  const handleReindex = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t("success") || "Success",
      t("documentReindexed") || "Document reindexed successfully",
    );
  }, [t]);

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      />
    );
  }

  if (!document) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot, padding: Spacing.xl },
        ]}
      >
        <ThemedText style={{ color: theme.textSecondary, textAlign: "center" }}>
          {t("error") || "Document not found"}
        </ThemedText>
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
            {document.name || documentName}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("type") || "Type"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {metadata.type}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("size") || "Size"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {formatBytes(metadata.size)}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("status") || "Status"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.success }]}>
            {t("indexed") || "Indexed"}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("chunks") || "Chunks"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {metadata.chunks}
          </ThemedText>
        </View>

        <View style={styles.metadataRow}>
          <ThemedText
            style={[styles.metadataLabel, { color: theme.textSecondary }]}
          >
            {t("uploaded") || "Uploaded"}
          </ThemedText>
          <ThemedText style={[styles.metadataValue, { color: theme.text }]}>
            {formatDate(document.createdAt)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={handleReindex}
        >
          <Feather name="refresh-cw" size={18} color="#fff" />
          <ThemedText style={styles.actionButtonText}>
            {t("reindex") || "Reindex"}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.error }]}
          onPress={handleDelete}
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
              {document.content || t("noContent") || "No content available"}
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
