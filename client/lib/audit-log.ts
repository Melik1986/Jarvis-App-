import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AuditEntry {
  timestamp: Date;
  command: string;
  apiCall: string;
  status: "success" | "failed";
  cost: string; // "$0.002"
  toolCalls: { toolName: string; args: unknown }[];
}

export class AuditLog {
  private static readonly STORAGE_KEY = "audit_log";
  private static readonly MAX_ENTRIES = 100;

  /**
   * Add a new audit log entry.
   */
  static async addEntry(entry: AuditEntry): Promise<void> {
    try {
      const logs = await this.getLogs();
      logs.push({
        ...entry,
        timestamp: new Date(), // Ensure timestamp is set
      });

      // Keep only last MAX_ENTRIES entries
      const trimmed = logs.slice(-this.MAX_ENTRIES);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to add audit log entry:", error);
    }
  }

  /**
   * Get all audit log entries.
   */
  static async getLogs(): Promise<AuditEntry[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data) as AuditEntry[];
      // Convert timestamp strings back to Date objects
      return parsed.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get audit logs:", error);
      return [];
    }
  }

  /**
   * Clear all audit log entries.
   */
  static async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to clear audit logs:", error);
    }
  }

  /**
   * Get logs filtered by date range.
   */
  static async getLogsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<AuditEntry[]> {
    const logs = await this.getLogs();
    return logs.filter(
      (entry) => entry.timestamp >= startDate && entry.timestamp <= endDate,
    );
  }

  /**
   * Get total cost from logs.
   */
  static async getTotalCost(): Promise<number> {
    const logs = await this.getLogs();
    return logs.reduce((total, entry) => {
      const costMatch = entry.cost.match(/\$?([\d.]+)/);
      if (costMatch) {
        return total + parseFloat(costMatch[1]);
      }
      return total;
    }, 0);
  }
}
