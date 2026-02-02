import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface DiffViewProps {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export function DiffView({ before, after }: DiffViewProps) {
  const renderValue = (value: unknown): string => {
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  return (
    <View style={styles.container}>
      {Array.from(allKeys).map((key) => {
        const beforeValue = before[key];
        const afterValue = after[key];
        const changed = beforeValue !== afterValue;

        if (!changed && beforeValue === undefined) {
          return null;
        }

        return (
          <View key={key} style={styles.row}>
            <Text style={styles.key}>{key}:</Text>
            {changed ? (
              <View style={styles.changed}>
                <Text style={styles.before}>
                  <Text style={styles.label}>Before: </Text>
                  {renderValue(beforeValue)}
                </Text>
                <Text style={styles.arrow}>→</Text>
                <Text style={styles.after}>
                  <Text style={styles.label}>After: </Text>
                  {renderValue(afterValue)}
                </Text>
              </View>
            ) : (
              <Text style={styles.unchanged}>{renderValue(afterValue)}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginVertical: 8,
  },
  row: {
    marginBottom: 8,
  },
  key: {
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4,
  },
  changed: {
    backgroundColor: "#fff3cd",
    padding: 8,
    borderRadius: 4,
  },
  before: {
    color: "#dc3545",
    fontSize: 12,
  },
  after: {
    color: "#28a745",
    fontSize: 12,
  },
  arrow: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 4,
  },
  unchanged: {
    color: "#6c757d",
    fontSize: 12,
  },
  label: {
    fontWeight: "600",
  },
});
