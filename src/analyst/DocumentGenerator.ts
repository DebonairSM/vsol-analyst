import { RequirementsSummary } from "./RequirementsTypes";

export class DocumentGenerator {
  generateRequirementsMarkdown(req: RequirementsSummary): string {
    const lines: string[] = [];

    lines.push(`# System Requirements`);
    lines.push("");
    if (req.businessContext.companyName) {
      lines.push(`**Client:** ${req.businessContext.companyName}`);
    }
    if (req.businessContext.industry) {
      lines.push(`**Industry:** ${req.businessContext.industry}`);
    }
    lines.push("");
    lines.push(`## Primary Goal`);
    lines.push(req.primaryGoal || "Not clearly defined yet.");
    lines.push("");

    if (req.secondaryGoals?.length) {
      lines.push(`## Secondary Goals`);
      for (const g of req.secondaryGoals) lines.push(`- ${g}`);
      lines.push("");
    }

    if (req.painPoints?.length) {
      lines.push(`## Pain Points`);
      for (const p of req.painPoints) {
        lines.push(
          `- ${p.description} (impact: ${p.impact}, frequency: ${p.frequency})`
        );
      }
      lines.push("");
    }

    if (req.candidateModules?.length) {
      lines.push(`## Candidate Modules`);
      for (const m of req.candidateModules) {
        lines.push(
          `- **${m.name}** (${m.priority}) - ${m.description}`
        );
      }
      lines.push("");
    }

    if (req.nonFunctionalNeeds?.length) {
      lines.push(`## Non Functional Needs`);
      for (const n of req.nonFunctionalNeeds) lines.push(`- ${n}`);
      lines.push("");
    }

    if (req.openQuestions?.length) {
      lines.push(`## Open Questions`);
      for (const q of req.openQuestions) lines.push(`- ${q}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  generateMermaidFlow(req: RequirementsSummary): string {
    const lines: string[] = [];
    lines.push("flowchart TD");

    // Simple actor to module flow
    for (const actor of req.mainActors || []) {
      const actorId = actor.name.replace(/\s+/g, "_");
      lines.push(`  ${actorId}["${actor.name}"]`);
    }

    for (const mod of req.candidateModules || []) {
      const modId = mod.name.replace(/\s+/g, "_");
      lines.push(`  ${modId}["${mod.name}"]`);
    }

    // naive linking: every actor connects to every module
    for (const actor of req.mainActors || []) {
      const actorId = actor.name.replace(/\s+/g, "_");
      for (const mod of req.candidateModules || []) {
        const modId = mod.name.replace(/\s+/g, "_");
        lines.push(`  ${actorId} --> ${modId}`);
      }
    }

    return lines.join("\n");
  }
}

