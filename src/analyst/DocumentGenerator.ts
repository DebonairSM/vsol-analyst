import { RequirementsSummary } from "./RequirementsTypes";

export class DocumentGenerator {
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
        lines.push(
          `- **${m.name}** (${m.priority}) - ${m.description}`
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

