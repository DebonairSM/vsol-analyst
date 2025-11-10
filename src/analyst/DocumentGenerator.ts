import { RequirementsSummary, UserStoriesOutput, Actor, CandidateModule } from "./RequirementsTypes";

/**
 * Relationship inference philosophy:
 * - Primary signals: module name + description
 * - Secondary: pain points that mention both actor and module
 * - Tertiary: goals (weak, alignment only)
 * - Threshold: score >= 2 draws an edge
 * - Fallback: connect isolated actors to the most plausible module, if any.
 *
 * This is intentionally simple and explainable; tweak weights,
 * not the shape of the logic, when behavior needs tuning.
 */

/**
 * Expectations for RequirementsSummary (for relationship inference):
 * - painPoints?: { description: string }[]
 * - primaryGoal?: string
 * - secondaryGoals?: string[]
 * - currentTools?: string[]  // Future: could be { name, direction?: "in" | "out" | "both" }[]
 * - mainActors?: { name: string; description: string }[]
 * - candidateModules?: { name: string; description?: string; priority?: "must-have" | "should-have" | "nice-to-have" }[]
 */

const ROLE_SYNONYMS: Record<string, string[]> = {
  owner: ["owner", "admin", "administrator", "management", "manager", "director"],
  consultant: ["consultant", "freelancer", "contractor"],
  client: ["client", "customer", "user"],
  employee: ["employee", "staff", "team member"],
  manager: ["manager", "supervisor", "lead", "coordinator"],
};

const STOPWORDS = new Set([
  "the", "and", "of", "for", "to", "in", "on", "at", "by", "with",
  "from", "as", "is", "are", "was", "were", "be", "been", "being"
]);

const DEFAULT_SCORE_THRESHOLD = 2;
const MAX_SCORE = 9; // Current max: desc(2) + name(2) + pain(2) + goals(1) + priority(1) + mgmt-affinity(1) = 9

const MANAGEMENT_ROLES = ["owner", "manager", "director", "accountant"];
const MANAGEMENT_MODULE_KEYWORDS = ["report", "analytics", "dashboard", "status"];
const CLIENT_ROLES = ["client", "customer", "user"];

export class DocumentGenerator {
  constructor(
    private readonly scoreThreshold = DEFAULT_SCORE_THRESHOLD,
    private readonly simpleMode = false  // Escape hatch for debugging
  ) {}
  generateRequirementsMarkdown(req: RequirementsSummary): string {
    const lines: string[] = [];

    lines.push(`# System Requirements`);
    lines.push("");
    
    // Business Context
    if (req.businessContext.companyName) {
      lines.push(`**Client:** ${req.businessContext.companyName}`);
    }
    if (req.businessContext.industry) {
      lines.push(`**Industry:** ${req.businessContext.industry}`);
    }
    if (req.businessContext.region) {
      lines.push(`**Region:** ${req.businessContext.region}`);
    }
    if (req.businessContext.sizeDescription) {
      lines.push(`**Size:** ${req.businessContext.sizeDescription}`);
    }
    lines.push("");
    
    // Primary Goal
    lines.push(`## Primary Goal`);
    lines.push(req.primaryGoal || "Not clearly defined yet.");
    lines.push("");

    // Secondary Goals
    if (req.secondaryGoals?.length) {
      lines.push(`## Secondary Goals`);
      for (const g of req.secondaryGoals) lines.push(`- ${g}`);
      lines.push("");
    }

    // Uploaded Documents - Show this prominently near the top
    if (req.uploadedDocuments?.length) {
      lines.push(`## Uploaded Documents and Data Sources`);
      for (const doc of req.uploadedDocuments) {
        lines.push(`### ${doc.filename}`);
        lines.push(`**Type:** ${doc.type}`);
        lines.push("");
        
        if (doc.sheets?.length) {
          lines.push(`**Sheets:**`);
          for (const sheet of doc.sheets) {
            lines.push(`- **${sheet.name}**: ${sheet.rows} rows × ${sheet.columns} columns`);
            if (sheet.headers?.length) {
              lines.push(`  - Headers: ${sheet.headers.join(", ")}`);
            }
            if (sheet.sampleData) {
              lines.push(`  - Sample: ${sheet.sampleData}`);
            }
          }
          lines.push("");
        }
        
        if (doc.summary) {
          lines.push("**Summary:**");
          lines.push(doc.summary);
          lines.push("");
        }
      }
    }

    // Current Tools
    if (req.currentTools?.length) {
      lines.push(`## Current Tools and Systems`);
      for (const tool of req.currentTools) lines.push(`- ${tool}`);
      lines.push("");
    }

    // Main Actors
    if (req.mainActors?.length) {
      lines.push(`## Users and Roles`);
      for (const actor of req.mainActors) {
        lines.push(`- **${actor.name}**: ${actor.description}`);
      }
      lines.push("");
    }

    // Pain Points
    if (req.painPoints?.length) {
      lines.push(`## Pain Points`);
      for (const p of req.painPoints) {
        lines.push(
          `- ${p.description} (impact: ${p.impact}, frequency: ${p.frequency})`
        );
      }
      lines.push("");
    }

    // Data Entities - CRITICAL for spreadsheet data
    if (req.dataEntities?.length) {
      lines.push(`## Data Entities and Structure`);
      for (const entity of req.dataEntities) {
        lines.push(`### ${entity.name}`);
        if (entity.fields?.length) {
          for (const field of entity.fields) {
            lines.push(`- ${field}`);
          }
        }
        lines.push("");
      }
    }

    // Candidate Modules
    if (req.candidateModules?.length) {
      lines.push(`## Candidate Modules`);
      for (const m of req.candidateModules) {
        const priority = m.priority ?? "unspecified";
        const desc = m.description ?? "Description not yet defined.";
        lines.push(
          `- **${m.name}** (${priority}) - ${desc}`
        );
      }
      lines.push("");
    }

    // Non Functional Needs
    if (req.nonFunctionalNeeds?.length) {
      lines.push(`## Non Functional Needs`);
      for (const n of req.nonFunctionalNeeds) lines.push(`- ${n}`);
      lines.push("");
    }

    // Risks and Constraints
    if (req.risksAndConstraints?.length) {
      lines.push(`## Risks and Constraints`);
      for (const risk of req.risksAndConstraints) {
        lines.push(`- ${risk.description} (type: ${risk.type})`);
      }
      lines.push("");
    }

    // Open Questions
    if (req.openQuestions?.length) {
      lines.push(`## Open Questions`);
      for (const q of req.openQuestions) lines.push(`- ${q}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  // ===== Text Processing Helpers =====

  private normalizeText(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(word => 
          word.length > 0 && 
          !STOPWORDS.has(word) &&
          !/^\d+$/.test(word) // Filter out purely numeric tokens
        )
    );
  }

  private isStrongKeywordMatch(keywords: string[], targetWords: Set<string>): boolean {
    for (const kw of keywords) {
      if (targetWords.has(kw)) {
        return true;
      }
    }
    return false;
  }

  private isWeakKeywordMatch(keywords: string[], targetWords: Set<string>): boolean {
    // Substring matching with guards:
    // - keyword length >= 4 (prevents "man" matching everything)
    // - target word contains keyword
    for (const kw of keywords) {
      if (kw.length < 4) continue;
      for (const w of targetWords) {
        if (w.includes(kw)) return true;
      }
    }
    return false;
  }

  private hasAnyCommonWord(a: Set<string>, b: Set<string>): boolean {
    // Set intersection check (cleaner than spreading)
    for (const w of a) {
      if (b.has(w)) return true;
    }
    return false;
  }

  // ===== Domain Logic Helpers =====

  private makeIdFromName(name: string, usedIds: Set<string>): string {
    // Generate unique Mermaid node IDs with collision handling
    let base = name.trim().toLowerCase()
      .replace(/[^a-z0-9_ ]+/g, "")
      .replace(/\s+/g, "_");

    if (!base) base = "node";

    let id = base;
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${base}_${counter++}`;
    }
    usedIds.add(id);
    return id;
  }

  private extractActorKeywords(actorName: string): string[] {
    const normalized = actorName.toLowerCase();
    const words = normalized.split(/\s+/).filter(w => w.length > 0 && !STOPWORDS.has(w));
    
    // Check if any word matches a role synonym key
    for (const word of words) {
      if (ROLE_SYNONYMS[word]) {
        return ROLE_SYNONYMS[word];
      }
    }
    
    // Otherwise return the normalized words
    return words;
  }

  // Pure scoring function: depends only on its arguments.
  // All normalization should be done before calling this.
  private scoreActorModuleRelation(
    actor: Actor,
    module: CandidateModule,
    req: RequirementsSummary,
    actorKeywords: string[],
    moduleDescWords: Set<string>,
    moduleNameWords: Set<string>
  ): number {
    let score = 0;

    // Early exit if module description is too short (by word count)
    if (!moduleDescWords || moduleDescWords.size < 2) {
      return 0;
    }

    // 1. Module description (0-2 points)
    if (this.isStrongKeywordMatch(actorKeywords, moduleDescWords)) {
      score += 2;
    } else if (this.isWeakKeywordMatch(actorKeywords, moduleDescWords)) {
      score += 1;
    }

    // 2. Module name (0-2 points) - high signal
    if (this.isStrongKeywordMatch(actorKeywords, moduleNameWords)) {
      score += 2;
    }

    // 3. Pain points (0-2 points) - STRICT: both actor AND module must be present
    for (const pp of req.painPoints || []) {
      const ppWords = this.normalizeText(pp.description);
      const hasActor = this.isStrongKeywordMatch(actorKeywords, ppWords);
      const hasModule = this.hasAnyCommonWord(moduleNameWords, ppWords);
      
      if (hasActor && hasModule) {
        score += 2;
        break;
      }
    }

    // 4. Goals (0-2 points) - WEAK signal, only if clear alignment
    // Note: Currently treat all goals equally; if needed, give primaryGoal extra weight later
    const allGoals = [req.primaryGoal, ...(req.secondaryGoals || [])].filter(Boolean);
    for (const goal of allGoals) {
      const goalWords = this.normalizeText(goal);
      const hasActor = this.isWeakKeywordMatch(actorKeywords, goalWords);
      const hasModule = this.hasAnyCommonWord(moduleNameWords, goalWords);
      
      if (hasActor && hasModule) {
        score += 1;
        break;
      }
    }

    // 5. Priority boost (0-1 point)
    if (module.priority === "must-have") {
      score += 1;
    }

    // 6. Management-module affinity (0-1 point)
    // Owners, managers, directors, accountants prefer reporting/analytics/dashboards
    const actorLower = actor.name.toLowerCase();
    const hasManagementRole = MANAGEMENT_ROLES.some(role => actorKeywords.includes(role));
    const hasWifeRelation = actorLower.includes("wife") && 
      (req.mainActors || []).some(a => a.name.toLowerCase().includes("owner"));

    if (hasManagementRole || hasWifeRelation) {
      const moduleNameLower = module.name.toLowerCase();
      const isManagementModule = MANAGEMENT_MODULE_KEYWORDS.some(kw => 
        moduleNameLower.includes(kw)
      );
      if (isManagementModule) {
        score += 1;
      }
    }

    // Guard against runaway scores
    return Math.min(score, MAX_SCORE);
  }

  // `actor` parameter reserved for future role-aware fallback logic (e.g., managers prefer dashboards)
  private findBestFallbackModule(
    actor: Actor,
    modules: CandidateModule[],
    scoresForActor: Map<string, number>
  ): { module: CandidateModule; score: number } | null {
    // Check if this is a client/external actor - skip fallback for them
    const actorLower = actor.name.toLowerCase();
    const actorWords = actorLower.split(/\s+/);
    const isClientRole = CLIENT_ROLES.some(role => actorWords.includes(role));
    
    let best: CandidateModule | null = null;
    let bestScore = 0;

    // Reuse precomputed scores (no recomputation)
    for (const mod of modules) {
      const score = scoresForActor.get(mod.name) ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = mod;
      }
    }

    // Skip fallback for client/external actors unless they have a meaningful score
    if (isClientRole && bestScore < 2) {
      return null;
    }

    // If no positive score, search by central name patterns
    if (!best || bestScore === 0) {
      for (const mod of modules) {
        const nameLower = mod.name.toLowerCase();
        if (nameLower.includes("portal") || 
            nameLower.includes("dashboard") ||
            nameLower.includes("main") ||
            nameLower.includes("home")) {
          if (mod.priority === "must-have") {
            return { module: mod, score: 0 };
          }
          if (!best) best = mod;
        }
      }
    }

    return best ? { module: best, score: bestScore } : null;
  }

  generateMermaidFlow(req: RequirementsSummary): string {
    // Simple mode: render all actors + modules with full bipartite edges (debugging)
    if (this.simpleMode) {
      const lines = ["flowchart TD"];
      const usedIds = new Set<string>();
      const actorIds = new Map<string, string>();
      const moduleIds = new Map<string, string>();
      
      for (const actor of req.mainActors || []) {
        const actorId = this.makeIdFromName(actor.name, usedIds);
        actorIds.set(actor.name, actorId);
        lines.push(`  ${actorId}["${actor.name}"]`);
      }
      for (const mod of req.candidateModules || []) {
        const modId = this.makeIdFromName(mod.name, usedIds);
        moduleIds.set(mod.name, modId);
        lines.push(`  ${modId}["${mod.name}"]`);
      }
      for (const actor of req.mainActors || []) {
        const actorId = actorIds.get(actor.name)!;
        for (const mod of req.candidateModules || []) {
          const modId = moduleIds.get(mod.name)!;
          lines.push(`  ${actorId} --> ${modId}`);
        }
      }
      return lines.join("\n");
    }

    // Continue with intelligent inference below...
    const lines: string[] = [];
    lines.push("flowchart TD");

    const debugEnabled = 
      process.env.NODE_ENV !== "production" &&
      process.env.MERMAID_DEBUG_RELATIONS === "true";
    const debugScores: string[] | null = debugEnabled ? [] : null;

    const usedIds = new Set<string>();

    const hasActors = req.mainActors?.length > 0;
    const hasModules = req.candidateModules?.length > 0;

    // Handle partial extraction gracefully
    if (!hasActors && !hasModules) {
      lines.push("  NoData[No actors or modules identified]");
      return lines.join("\n");
    }

    if (!hasActors) {
      lines.push("  NoActors[No actors identified]");
    }

    if (!hasModules) {
      lines.push("  NoModules[No modules identified]");
      // Early return: no modules means no meaningful edges or tools to process
      // Still render actors if present
      if (hasActors) {
        const actors = [...req.mainActors!].sort((a, b) => a.name.localeCompare(b.name));
        const usedIds = new Set<string>();
        for (const actor of actors) {
          const id = this.makeIdFromName(actor.name, usedIds);
          lines.push(`  ${id}["${actor.name}"]`);
        }
      }
      return lines.join("\n");
    }

    // Sort for deterministic output
    const actors = [...(req.mainActors || [])].sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    const modules = [...(req.candidateModules || [])].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    // Actor keywords cache
    const actorKeywordCache = new Map<string, string[]>();
    const getActorKeywords = (actor: Actor): string[] => {
      if (!actorKeywordCache.has(actor.name)) {
        actorKeywordCache.set(actor.name, this.extractActorKeywords(actor.name));
      }
      return actorKeywordCache.get(actor.name)!;
    };

    // Module data (single normalization pass)
    const moduleDataMap = new Map<string, {
      descWords: Set<string>,
      nameWords: Set<string>
    }>();

    for (const mod of modules) {
      moduleDataMap.set(mod.name, {
        descWords: this.normalizeText(mod.description || ""),
        nameWords: this.normalizeText(mod.name)
      });
    }

    // Tools (precompute once)
    // Future: if RequirementsSummary.currentTools carries direction info,
    // we can flip edges (Module --> Tool) for exports, etc.
    const tools = (req.currentTools || []).map(tool => ({
      name: tool,
      words: this.normalizeText(tool),
      id: "", // Will be set during node generation
    }));

    // Actor nodes
    const actorIdMap = new Map<string, string>();
    for (const actor of actors) {
      const id = this.makeIdFromName(actor.name, usedIds);
      actorIdMap.set(actor.name, id);
      lines.push(`  ${id}["${actor.name}"]`);
    }

    // Module nodes
    const moduleIdMap = new Map<string, string>();
    for (const mod of modules) {
      const id = this.makeIdFromName(mod.name, usedIds);
      moduleIdMap.set(mod.name, id);
      lines.push(`  ${id}["${mod.name}"]`);
    }

    // Tool nodes (if mentioned in modules)
    const toolIdMap = new Map<string, string>();
    for (const tool of tools) {
      for (const mod of modules) {
        const md = moduleDataMap.get(mod.name);
        if (!md) continue; // Safety net
        
        const hasTool = [...tool.words].some(w => md.descWords.has(w));
        
        if (hasTool && !toolIdMap.has(tool.name)) {
          const id = this.makeIdFromName(tool.name, usedIds);
          toolIdMap.set(tool.name, id);
          tool.id = id;
          lines.push(`  ${id}["${tool.name}"]`);
          break;
        }
      }
    }

    // Edge generation
    const edges: string[] = [];

    for (const actor of actors) {
      const actorId = actorIdMap.get(actor.name)!;
      const actorKeywords = getActorKeywords(actor);
      const perActorScores = new Map<string, number>();
      let connections = 0;
      
      for (const mod of modules) {
        const modId = moduleIdMap.get(mod.name)!;
        const md = moduleDataMap.get(mod.name);
        if (!md) continue; // Safety net
        
        const score = this.scoreActorModuleRelation(
          actor, mod, req, actorKeywords, md.descWords, md.nameWords
        );
        
        perActorScores.set(mod.name, score);
        
        if (debugEnabled) {
          debugScores!.push(`${actor.name} -> ${mod.name}: ${score}`);
        }
        
        if (score >= this.scoreThreshold) {
          edges.push(`  ${actorId} --> ${modId}`);
          connections++;
        }
      }
      
      // Fallback for isolated actors (reuses computed scores)
      if (connections === 0) {
        const fallback = this.findBestFallbackModule(actor, modules, perActorScores);
        if (fallback && fallback.score > 0) {
          const fallbackId = moduleIdMap.get(fallback.module.name)!;
          edges.push(`  ${actorId} --> ${fallbackId}   %% fallback`);
        }
      }
    }

    lines.push(...edges);

    // Tool edges (consistent: Tool --> Module)
    for (const tool of tools) {
      if (!toolIdMap.has(tool.name)) continue;
      
      const toolId = toolIdMap.get(tool.name)!;
      for (const mod of modules) {
        const md = moduleDataMap.get(mod.name);
        if (!md) continue; // Safety net
        
        const hasTool = [...tool.words].some(w => md.descWords.has(w));
        
        if (hasTool) {
          const modId = moduleIdMap.get(mod.name)!;
          lines.push(`  ${toolId} --> ${modId}   %% integration`);
        }
      }
    }

    // Debug output with legend
    if (debugEnabled) {
      lines.push("");
      lines.push("%% Debug: relationship scores");
      lines.push(`%% Legend: 0=none, 1=weak alignment, 2+=strong enough for edge (threshold ${this.scoreThreshold})`);
      for (const debugLine of debugScores!) {
        lines.push(`%% ${debugLine}`);
      }
    }

    return lines.join("\n");
  }

  generateUserStoriesMarkdown(userStories: UserStoriesOutput): string {
    const lines: string[] = [];

    lines.push(`# User Stories`);
    lines.push("");
    lines.push(
      `**Total Stories:** ${userStories.totalStories} | ` +
      `**Must-Have:** ${userStories.byPriority.mustHave} | ` +
      `**Should-Have:** ${userStories.byPriority.shouldHave} | ` +
      `**Nice-to-Have:** ${userStories.byPriority.niceToHave}`
    );
    lines.push("");
    lines.push("---");
    lines.push("");

    // Group by Epic
    for (const epic of userStories.epics) {
      lines.push(`## Epic: ${epic.name}`);
      lines.push("");
      lines.push(`*${epic.description}*`);
      lines.push("");

      for (const story of epic.stories) {
        lines.push(`### ${story.id}: ${story.title}`);
        lines.push("");
        lines.push(`**As a** ${story.actor}`);
        lines.push(`**I want to** ${story.action}`);
        lines.push(`**So that** ${story.benefit}`);
        lines.push("");

        let metaLine = `**Priority:** ${story.priority} | **Effort:** ${story.effort}`;
        if (story.storyPoints) {
          metaLine += ` | **Story Points:** ${story.storyPoints}`;
        }
        if (story.sprint) {
          metaLine += ` | **Sprint:** ${story.sprint}`;
        }
        lines.push(metaLine);
        lines.push("");

        lines.push(`**Acceptance Criteria:**`);
        for (const criterion of story.acceptanceCriteria) {
          lines.push(`- [ ] ${criterion.description}`);
        }
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }

    return lines.join("\n");
  }
}

