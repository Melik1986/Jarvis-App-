import * as fs from "fs/promises";
import * as path from "path";
import type { RuleContext, SkillContext, ProjectContext } from "./beads.types";

/**
 * Parser for .cursor/rules and .cursor/skills
 * Extracts context for Beads task management and Ralph execution
 */
export class RulesParser {
  private cursorPath: string;

  constructor(cursorPath?: string) {
    this.cursorPath = cursorPath || path.join(process.cwd(), ".cursor");
  }

  /**
   * Load all project context (rules + skills)
   */
  async loadProjectContext(): Promise<ProjectContext> {
    const [rules, skills] = await Promise.all([
      this.loadAllRules(),
      this.loadAllSkills(),
    ]);

    // Extract project config from skill if available
    const projectSkill = skills.find(
      (s) => s.name.includes("jarvis") || s.name.includes("project"),
    );
    const projectConfig = projectSkill
      ? this.extractProjectConfig(projectSkill)
      : undefined;

    return { rules, skills, projectConfig };
  }

  /**
   * Load all rules from .cursor/rules/
   */
  async loadAllRules(): Promise<RuleContext[]> {
    const rulesPath = path.join(this.cursorPath, "rules");

    try {
      const files = await fs.readdir(rulesPath);
      const mdcFiles = files.filter(
        (f) => f.endsWith(".mdc") || f.endsWith(".md"),
      );

      const rules = await Promise.all(
        mdcFiles.map((file) => this.parseRuleFile(path.join(rulesPath, file))),
      );

      return rules.filter((r): r is RuleContext => r !== null);
    } catch (error) {
      console.error("Error loading rules:", error);
      return [];
    }
  }

  /**
   * Load all skills from .cursor/skills/
   */
  async loadAllSkills(): Promise<SkillContext[]> {
    const skillsPath = path.join(this.cursorPath, "skills");

    try {
      const entries = await fs.readdir(skillsPath, { withFileTypes: true });
      const skillDirs = entries.filter((e) => e.isDirectory());

      const skills = await Promise.all(
        skillDirs.map((dir) =>
          this.parseSkillDir(path.join(skillsPath, dir.name)),
        ),
      );

      return skills.filter((s): s is SkillContext => s !== null);
    } catch (error) {
      console.error("Error loading skills:", error);
      return [];
    }
  }

  /**
   * Parse a single rule file (.mdc)
   */
  async parseRuleFile(filePath: string): Promise<RuleContext | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const name = path.basename(filePath, path.extname(filePath));

      // Parse frontmatter
      const frontmatter = this.parseFrontmatter(content);
      const bodyContent = this.extractBody(content);

      // Extract key points from content
      const keyPoints = this.extractKeyPoints(bodyContent);

      return {
        name,
        path: filePath,
        description: frontmatter.description,
        globs: frontmatter.globs,
        alwaysApply:
          frontmatter.alwaysApply === true ||
          frontmatter.alwaysApply === "true",
        content: bodyContent,
        keyPoints,
      };
    } catch (error) {
      console.error(`Error parsing rule file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse a skill directory
   */
  async parseSkillDir(dirPath: string): Promise<SkillContext | null> {
    try {
      const skillFile = path.join(dirPath, "SKILL.md");
      const refFile = path.join(dirPath, "reference.md");

      const skillContent = await fs.readFile(skillFile, "utf-8");
      let referenceContent: string | undefined;

      try {
        referenceContent = await fs.readFile(refFile, "utf-8");
      } catch {
        // Reference file is optional
      }

      const name = path.basename(dirPath);
      const frontmatter = this.parseFrontmatter(skillContent);
      const bodyContent = this.extractBody(skillContent);

      // Extract triggers (when to use this skill)
      const triggers = this.extractTriggers(
        frontmatter.description || bodyContent,
      );

      // Find related rules
      const relatedRules = this.findRelatedRules(bodyContent);

      return {
        name,
        path: dirPath,
        description: frontmatter.description || frontmatter.name || name,
        triggers,
        skillContent: bodyContent,
        referenceContent,
        relatedRules,
      };
    } catch (error) {
      console.error(`Error parsing skill dir ${dirPath}:`, error);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  private parseFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yamlContent = match[1];
    const result: Record<string, unknown> = {};

    // Simple YAML parsing (key: value)
    const lines = yamlContent.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Handle arrays
      if (value === "") {
        // Check for array on next lines
        continue;
      }

      // Handle quoted strings
      if (
        typeof value === "string" &&
        value.startsWith('"') &&
        value.endsWith('"')
      ) {
        value = value.slice(1, -1);
      }

      // Handle arrays in brackets
      if (
        typeof value === "string" &&
        value.startsWith("[") &&
        value.endsWith("]")
      ) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }

      // Handle booleans
      if (value === "true") value = true;
      if (value === "false") value = false;

      result[key] = value;
    }

    return result;
  }

  /**
   * Extract body content (without frontmatter)
   */
  private extractBody(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
  }

  /**
   * Extract key points from rule/skill content
   */
  private extractKeyPoints(content: string): string[] {
    const points: string[] = [];

    // Extract headers
    const headers = content.match(/^#{1,3}\s+(.+)$/gm);
    if (headers) {
      points.push(...headers.map((h) => h.replace(/^#+\s+/, "")));
    }

    // Extract list items (important rules)
    const listItems = content.match(/^[-*]\s+(.+)$/gm);
    if (listItems) {
      const importantItems = listItems
        .map((item) => item.replace(/^[-*]\s+/, ""))
        .filter(
          (item) =>
            item.includes("MUST") ||
            item.includes("ALWAYS") ||
            item.includes("NEVER") ||
            item.includes("обязательно") ||
            item.includes("запрещено") ||
            item.length < 100,
        )
        .slice(0, 10);
      points.push(...importantItems);
    }

    return [...new Set(points)];
  }

  /**
   * Extract triggers from description
   */
  private extractTriggers(text: string): string[] {
    const triggers: string[] = [];

    // Look for "Use when" patterns
    const useWhenMatch = text.match(/Use when[^.]*\./gi);
    if (useWhenMatch) {
      triggers.push(...useWhenMatch);
    }

    // Look for keywords
    const keywords = [
      "1C",
      "1С",
      "ERP",
      "voice",
      "vision",
      "RAG",
      "auth",
      "Supabase",
      "Qdrant",
      "Tamagui",
      "chat",
      "MCP",
    ];

    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        triggers.push(keyword);
      }
    }

    return [...new Set(triggers)];
  }

  /**
   * Find related rules mentioned in content
   */
  private findRelatedRules(content: string): string[] {
    const ruleRefs = content.match(
      /\.cursor\/rules\/[\w-]+\.mdc|rules\/[\w-]+\.mdc|rule\s+\*\*[\w-]+\.mdc\*\*/gi,
    );
    if (!ruleRefs) return [];

    return ruleRefs.map((ref) => {
      const match = ref.match(/([\w-]+)\.mdc/);
      return match ? match[1] : ref;
    });
  }

  /**
   * Extract project config from skill content
   */
  private extractProjectConfig(
    skill: SkillContext,
  ): ProjectContext["projectConfig"] {
    const content = skill.skillContent + (skill.referenceContent || "");

    // Extract modules from tables or lists
    const moduleMatch = content.match(/\|\s*\*\*([^|]+)\*\*\s*\|/g);
    const modules = moduleMatch
      ? moduleMatch.map((m) => m.replace(/\|\s*\*\*|\*\*\s*\|/g, "").trim())
      : [];

    // Extract stack from tables
    const stackMatch = content.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g);
    const stack = stackMatch
      ? stackMatch
          .slice(2) // Skip header rows
          .map((m) => {
            const parts = m.split("|").filter((p) => p.trim());
            return parts.map((p) => p.trim());
          })
          .flat()
          .filter((s) => s && !s.includes("---"))
      : [];

    return {
      name: skill.name,
      description: skill.description,
      modules: modules.slice(0, 10),
      stack: stack.slice(0, 20),
    };
  }

  /**
   * Get rule by name
   */
  async getRuleByName(name: string): Promise<RuleContext | null> {
    const rulesPath = path.join(this.cursorPath, "rules");
    const filePath = path.join(rulesPath, `${name}.mdc`);

    try {
      await fs.access(filePath);
      return this.parseRuleFile(filePath);
    } catch {
      // Try without extension
      const files = await fs.readdir(rulesPath);
      const match = files.find((f) => f.startsWith(name));
      if (match) {
        return this.parseRuleFile(path.join(rulesPath, match));
      }
      return null;
    }
  }

  /**
   * Get skill by name
   */
  async getSkillByName(name: string): Promise<SkillContext | null> {
    const skillsPath = path.join(this.cursorPath, "skills");
    const dirPath = path.join(skillsPath, name);

    try {
      await fs.access(dirPath);
      return this.parseSkillDir(dirPath);
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const rulesParser = new RulesParser();
