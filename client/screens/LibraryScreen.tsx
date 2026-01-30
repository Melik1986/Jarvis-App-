import React, { useState } from "react";
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
import Svg, { Path, Circle, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";

import {
  AnimatedSearchIcon,
  AnimatedDocumentIcon,
} from "@/components/AnimatedIcons";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Document {
  id: string;
  name: string;
  type: "pdf" | "txt" | "docx" | "xlsx" | "other";
  size: string;
  uploadedAt: Date;
  status: "indexed" | "processing" | "error";
}

function DocumentTypeIcon({
  type,
  size = 24,
  color,
}: {
  type: Document["type"];
  size?: number;
  color: string;
}) {
  const strokeWidth = 1.5;

  switch (type) {
    case "pdf":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 2v6h6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 15h6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M9 18h6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );
    case "txt":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 2v6h6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M8 13h8M8 17h5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M14 2v6h6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
  }
}

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

const mockDocuments: Document[] = [];

export default function LibraryScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>(documents);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const filtered = documents.filter((doc) =>
        doc.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredDocuments(filtered);
    } else {
      setFilteredDocuments(documents);
    }
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
        const fileExtension = file.name.split(".").pop()?.toLowerCase() || "other";
        const fileType: Document["type"] =
          fileExtension === "pdf"
            ? "pdf"
            : fileExtension === "txt"
              ? "txt"
              : fileExtension === "docx"
                ? "docx"
                : fileExtension === "xlsx"
                  ? "xlsx"
                  : "other";

        const newDoc: Document = {
          id: Date.now().toString(),
          name: file.name,
          type: fileType,
          size: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Unknown",
          uploadedAt: new Date(),
          status: "processing",
        };

        setDocuments((prev) => [newDoc, ...prev]);
        setFilteredDocuments((prev) => [newDoc, ...prev]);

        setTimeout(() => {
          setDocuments((prev) =>
            prev.map((d) => (d.id === newDoc.id ? { ...d, status: "indexed" as const } : d))
          );
          setFilteredDocuments((prev) =>
            prev.map((d) => (d.id === newDoc.id ? { ...d, status: "indexed" as const } : d))
          );
        }, 2000);
      }
    } catch (error) {
      console.error("Document picker error:", error);
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
          setDocuments((prev) => prev.filter((d) => d.id !== docId));
          setFilteredDocuments((prev) => prev.filter((d) => d.id !== docId));
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

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t("justNow");
    if (hours < 1) return `${minutes}m`;
    if (days < 1) return `${hours}${t("hoursAgo")}`;
    return `${days}${t("daysAgo")}`;
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <View
      style={[styles.documentCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View
        style={[
          styles.documentIcon,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <DocumentTypeIcon type={item.type} size={28} color={theme.primary} />
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
          <ThemedText style={[styles.documentSize, { color: theme.textSecondary }]}>
            {item.size}
          </ThemedText>
          <ThemedText style={[styles.documentDate, { color: theme.textTertiary }]}>
            {formatDate(item.uploadedAt)}
          </ThemedText>
        </View>
        <View style={styles.statusRow}>
          <View
            style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]}
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
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.headerSection,
          { marginTop: headerHeight + Spacing.lg },
        ]}
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

        <ThemedText
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
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
          <EmptyState
            title={t("emptyLibrary")}
            subtitle={t("uploadDocsHint")}
            image={require("../../assets/images/empty-library.png")}
          />
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
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
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
});
