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
 * Metrics returned by analyzeMermaidRelationships to diagnose
 * structural issues in the generated workflow diagram.
 */
export interface MermaidMetrics {
  actorsWithNoConnections: string[];
  modulesWithNoConnections: string[];
  suspiciousClientEdges: string[];
  keyModulesMissingOrOrphaned: string[];
}

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

    lines.push(`# Requirements for Business Review`);
    lines.push("");

    // Put a concise, client-readable overview and review status before detail.
    lines.push(`## Client Summary`);
    lines.push(this.clientSummary(req));
    lines.push("");

    lines.push(`## Confirmed Facts`);
    if (req.confirmedFacts?.length) {
      for (const fact of req.confirmedFacts) lines.push(`- ${fact}`);
    } else {
      lines.push("No confirmed facts have been recorded yet.");
    }
    lines.push("");

    lines.push(`## Assumptions`);
    if (req.assumptions?.length) {
      for (const assumption of req.assumptions) lines.push(`- ${assumption}`);
    } else {
      lines.push("No assumptions have been recorded.");
    }
    lines.push("");

    lines.push(`## Open Questions`);
    if (req.openQuestions?.length) {
      for (const question of req.openQuestions) lines.push(`- ${question}`);
    } else {
      lines.push("No open questions have been recorded.");
    }
    lines.push("");

    if (req.expensiveMisses?.length) {
      lines.push(`## Expensive Gaps to Resolve`);
      lines.push(
        "These unresolved areas can cause costly rework if they are decided late."
      );
      for (const finding of req.expensiveMisses) {
        lines.push(`- **${finding.label}:** ${finding.question}`);
      }
      lines.push("");
    }
    
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

    // Business vocabulary is an explicit review surface, including for
    // legacy or thin-discovery projects where no terms have been confirmed.
    lines.push(`## Ubiquitous Language / Key Terms`);
    if (req.ubiquitousLanguage?.length) {
      for (const term of req.ubiquitousLanguage) {
        const status = term.status === "confirmed" ? "Confirmed" : "Needs clarification";
        lines.push(`### ${term.preferredTerm}`);
        lines.push(term.definition || "Definition not yet confirmed.");
        lines.push(`- **Status:** ${status}`);
        if (term.aliases?.length) {
          lines.push(`- **Also heard as:** ${term.aliases.join(", ")}`);
        }
        if (term.sources?.length) {
          lines.push(`- **Sources:** ${term.sources.join(", ")}`);
        }
        if (term.clarificationQuestion) {
          lines.push(`- **Clarification needed:** ${term.clarificationQuestion}`);
        }
        lines.push("");
      }
    } else {
      lines.push("No business-specific terms have been recorded yet.");
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
      lines.push(`## Information the Business Needs`);
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
      lines.push(`## Proposed Capabilities`);
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
      lines.push(`## Quality, Access, and Operating Needs`);
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

    return lines.join("\n");
  }

  private clientSummary(req: RequirementsSummary): string {
    const supplied = req.clientSummary?.trim();
    if (supplied) return supplied;

    const sentences: string[] = [];
    const goal = req.primaryGoal?.trim();
    if (goal) sentences.push(goal.endsWith(".") ? goal : `${goal}.`);

    const mustHaveNames = (req.candidateModules ?? [])
      .filter((module) => module.priority === "must-have")
      .map((module) => module.name.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (mustHaveNames.length) {
      sentences.push(`The proposed first scope centers on ${this.joinBusinessList(mustHaveNames)}.`);
    }

    return sentences.join(" ") || "A client summary has not been recorded yet.";
  }

  private joinBusinessList(values: string[]): string {
    if (values.length < 2) return values[0] ?? "";
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
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
    // The LLM now generates the Mermaid diagram directly
    // We just need to wrap it in markdown code fences
    if (!req.workflowDiagram || req.workflowDiagram.trim() === "") {
      return "```mermaid\nflowchart TD\n  no_diagram[\"No workflow diagram generated\"]\n```";
    }
    
    // If already wrapped in code fences, return as-is
    if (req.workflowDiagram.trim().startsWith("```mermaid")) {
      return req.workflowDiagram;
    }
    
    // Otherwise wrap it
    return "```mermaid\n" + req.workflowDiagram.trim() + "\n```";
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

        const metaLine = `**Priority:** ${story.priority} | **Effort:** ${story.effort} | **Team:** ${story.team || "Team Sunny"}`;
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

  /**
   * Analyze the relationships in a RequirementsSummary and return metrics
   * indicating potential structural issues in the Mermaid diagram.
   * 
   * This method runs the same relationship inference as generateMermaidFlow,
   * but returns diagnostics instead of the diagram itself.
   */
  analyzeMermaidRelationships(req: RequirementsSummary): MermaidMetrics {
    const metrics: MermaidMetrics = {
      actorsWithNoConnections: [],
      modulesWithNoConnections: [],
      suspiciousClientEdges: [],
      keyModulesMissingOrOrphaned: [],
    };

    const actors = req.mainActors || [];
    const modules = req.candidateModules || [];
    const tools = req.currentTools || [];

    if (actors.length === 0 || modules.length === 0 || !req.workflowDiagram) {
      return metrics;
    }

    // Parse the Mermaid diagram to find connections
    const diagram = req.workflowDiagram;
    
    // Extract node definitions and labels
    const nodeLabels = new Map<string, string>(); // nodeId -> label
    const nodeRegex = /(\w+)\["([^"]+)"\]/g;
    let match;
    while ((match = nodeRegex.exec(diagram)) !== null) {
      nodeLabels.set(match[1], match[2]);
    }

    // Create reverse lookup: label -> nodeId
    const labelToId = new Map<string, string>();
    for (const [id, label] of nodeLabels.entries()) {
      labelToId.set(label, id);
    }

    // Extract edges (connections)
    const edges: Array<{from: string, to: string}> = [];
    const edgeRegex = /(\w+)\s*-->\s*(\w+)/g;
    while ((match = edgeRegex.exec(diagram)) !== null) {
      edges.push({ from: match[1], to: match[2] });
    }

    // Track connections per actor and module
    const actorConnections = new Map<string, number>();
    const moduleConnections = new Map<string, number>();

    for (const actor of actors) {
      actorConnections.set(actor.name, 0);
    }
    for (const mod of modules) {
      moduleConnections.set(mod.name, 0);
    }

    // Count connections by matching actor/module names to node labels
    for (const edge of edges) {
      const fromLabel = nodeLabels.get(edge.from) || "";
      const toLabel = nodeLabels.get(edge.to) || "";

      // Check if this edge involves an actor
      for (const actor of actors) {
        if (fromLabel === actor.name || toLabel === actor.name) {
          actorConnections.set(actor.name, actorConnections.get(actor.name)! + 1);
        }
      }

      // Check if this edge involves a module
      for (const mod of modules) {
        if (fromLabel === mod.name || toLabel === mod.name) {
          moduleConnections.set(mod.name, moduleConnections.get(mod.name)! + 1);
        }
      }

      // Check for suspicious client edges
      const clientActor = actors.find(a => 
        fromLabel === a.name && CLIENT_ROLES.some(role => a.name.toLowerCase().includes(role))
      );
      if (clientActor) {
        const targetModule = modules.find(m => toLabel === m.name);
        if (targetModule) {
          const modNameLower = targetModule.name.toLowerCase();
          const isClientFacing = modNameLower.includes("portal") || 
                                 modNameLower.includes("client") ||
                                 modNameLower.includes("viewing");
          
          if (!isClientFacing) {
            metrics.suspiciousClientEdges.push(`${clientActor.name} --> ${targetModule.name}`);
          }
        }
      }
    }

    // Identify actors with no connections
    for (const actor of actors) {
      if (actorConnections.get(actor.name) === 0) {
        metrics.actorsWithNoConnections.push(actor.name);
      }
    }

    // Identify modules with no connections
    for (const mod of modules) {
      if (moduleConnections.get(mod.name) === 0) {
        metrics.modulesWithNoConnections.push(mod.name);
      }
    }

    // Check for key modules that are orphaned
    const keyModulePatterns = [
      "invoice submission portal",
      "status tracking",
      "reporting and analytics",
      "workflow visualization dashboard",
      "dashboard",
    ];

    for (const mod of modules) {
      const modNameLower = mod.name.toLowerCase();
      const isKeyModule = keyModulePatterns.some(pattern => 
        modNameLower.includes(pattern)
      );

      if (isKeyModule && moduleConnections.get(mod.name) === 0) {
        metrics.keyModulesMissingOrOrphaned.push(mod.name);
      }
    }

    return metrics;
  }
}

