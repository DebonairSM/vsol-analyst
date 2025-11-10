# Requirements Refinement Layer Implementation

## Overview

This implementation adds a two-pass requirements extraction pipeline that uses a fast, cheap model (gpt-4o-mini) for initial extraction, then optionally refines with a larger model (gpt-4o) only when structural issues are detected in the generated workflow diagram.

## Architecture

### Components Created

1. **MermaidMetrics Interface** (`src/analyst/DocumentGenerator.ts`)
   - Defines diagnostic metrics for relationship quality
   - Fields:
     - `actorsWithNoConnections`: Actors with no module edges
     - `modulesWithNoConnections`: Modules with no actor edges
     - `suspiciousClientEdges`: Client roles connected to internal modules
     - `keyModulesMissingOrOrphaned`: Important modules with no connections

2. **analyzeMermaidRelationships Method** (`src/analyst/DocumentGenerator.ts`)
   - Analyzes RequirementsSummary using same logic as diagram generation
   - Returns MermaidMetrics instead of Mermaid code
   - Detects:
     - Isolated actors and modules
     - Client actors incorrectly connected to back-office systems
     - Key modules (Status Tracking, Reporting, Dashboards, etc.) without users

3. **SYSTEM_PROMPT_REFINER** (`src/analyst/prompts.ts`)
   - System prompt for the refinement model
   - Focuses on:
     - Enriching actor and module descriptions
     - Fixing client/internal module boundaries
     - Clarifying integration vs user-facing modules
   - Conservative: only adjusts text, doesn't restructure

4. **RequirementsRefinementPipeline** (`src/analyst/RequirementsRefinementPipeline.ts`)
   - Orchestrates the two-pass extraction flow
   - Methods:
     - `extractWithRefinement()`: Main entry point
     - `needsRefinement()`: Decision logic based on metrics
     - `refineRequirements()`: Calls larger model with diagnostics
   - Returns:
     - Final RequirementsSummary
     - Generated markdown and Mermaid
     - `wasRefined` flag
     - Metrics for transparency

### Refinement Decision Logic

Refinement is triggered if any of these conditions are met:

1. Any actor has zero connections to modules
2. Any key module (Status Tracking, Reporting, Dashboard, Invoice Portal) is orphaned
3. Client/customer actors are connected to non-client-facing modules

### Integration

**Route Changes** (`src/routes/analyst.ts`):
- Instantiate both `llmMini` (gpt-4o-mini) and `llmFull` (gpt-4o)
- Create `RequirementsRefinementPipeline` instance
- Updated `/analyst/extract` endpoint to:
  - Use `refinementPipeline.extractWithRefinement()`
  - Return additional fields: `wasRefined`, `metrics`
- All other endpoints use `llmMini` for cost efficiency

## Testing

**Test Suites**:

1. `tests/RequirementsRefinementPipeline.test.ts` (11 tests):
   - Detection of actors with no connections
   - Detection of orphaned modules
   - Detection of suspicious client edges
   - Detection of orphaned key modules
   - Real-world consulting scenarios (both poor and good extractions)
   - Edge cases (empty actors, empty modules)

2. `tests/DocumentGenerator.mermaid.test.ts` (6 tests):
   - Existing relationship inference tests
   - Updated to handle mermaid wrapper format

3. `tests/MermaidOutputValidation.test.ts` (5 tests):
   - Validates mermaid code block wrapper format
   - Validates blank line separation between actor and tool edges
   - Ensures no consecutive comment parsing errors
   - Tests multiple tool integrations
   - Validates real-world scenario output syntax

**Test Results**:
- All 22 tests pass
- No regressions introduced
- Mermaid output is now properly wrapped and can be pasted directly into markdown files

## Cost/Performance Characteristics

**Without Issues** (typical case):
- Single gpt-4o-mini call for extraction
- Fast and cheap (current behavior)

**With Issues** (refinement needed):
- First pass: gpt-4o-mini extraction
- Second pass: gpt-4o refinement with diagnostics
- Slower and more expensive, but only when necessary

## Usage

The refinement layer is transparent to clients. The `/analyst/extract` endpoint now returns:

```typescript
{
  requirements: RequirementsSummary,
  markdown: string,
  mermaid: string,
  wasRefined: boolean,    // NEW: indicates if refinement was used
  metrics: MermaidMetrics // NEW: diagnostic information
}
```

Frontend can optionally display refinement status or metrics for debugging.

## Bug Fixes Applied

### Issue: Mermaid Parse Error
**Problem**: The generated Mermaid diagrams caused parse errors at the boundary between actor edges and tool edges:
```
Parse error on line 35: ...workflow_visualization_dashboard
Parse error on line 36: ...time_doctor --> integration...%% integration
Expecting 'SEMI', 'NEWLINE', 'EOF', got 'NODE_STRING'
```

**Root Cause**: Two issues were causing the parse error:
1. Tool integration edges were being added directly to the lines array immediately after actor edges
2. Missing blank line separator between different edge groups confused the Mermaid parser

**Solution**: 
1. Collect tool edges in a separate array before adding to output
2. Add blank line separator between actor edges and tool edges (when both exist)
3. Wrap all Mermaid output in ` ```mermaid ` code blocks for direct markdown pasting

**Validation**:
- Added `tests/MermaidOutputValidation.test.ts` with 5 syntax validation tests
- Specific test validates blank line separation between edge groups
- All 22 tests pass (11 refinement + 6 mermaid + 5 validation)
- Output is now valid Mermaid syntax and markdown-ready

## Future Enhancements

Possible improvements:
1. Make refinement model configurable via environment variable
2. Add metrics logging/monitoring to track refinement frequency
3. Expose refinement decision threshold as configuration
4. Add more sophisticated heuristics (e.g., module description quality scoring)
5. Cache mini-model results to avoid re-extraction on refinement failure

