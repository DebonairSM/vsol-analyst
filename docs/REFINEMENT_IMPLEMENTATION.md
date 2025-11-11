# Refinement Layer Implementation

## Overview

This implementation adds two-pass pipelines with automatic quality-based refinement for:
1. **Requirements Extraction** - Uses gpt-4o-mini, refines with gpt-4o when diagram relationship issues are detected
2. **User Story Generation** - Uses gpt-4o-mini, refines with gpt-4o when story quality issues are detected

Both pipelines include comprehensive logging to track when and why the larger model is used.

## Architecture

### Components Created

## Requirements Refinement Components

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
   - **Includes comprehensive logging** for model usage and issue detection

## User Story Refinement Components

5. **UserStoryMetrics Interface** (`src/analyst/StoryGenerator.ts`)
   - Defines diagnostic metrics for story quality
   - Fields:
     - `storiesWithoutAcceptanceCriteria`: Stories missing AC
     - `storiesWithVagueActions`: Stories with generic verbs
     - `storiesWithoutBenefits`: Stories missing "so that" benefits
     - `epicsWithFewStories`: Thin epics (only 1 story)
     - `totalQualityScore`: 0-100 score, higher is better

6. **analyzeStoryQuality Method** (`src/analyst/StoryGenerator.ts`)
   - Analyzes UserStoriesOutput quality
   - Detects:
     - Missing or empty acceptance criteria
     - Vague actions (manage, handle, use, access)
     - Missing or too-short benefits
     - Epics with insufficient stories
   - Calculates quality score with weighted deductions

7. **SYSTEM_PROMPT_STORY_REFINER** (`src/analyst/prompts.ts`)
   - System prompt for story refinement model
   - Focuses on:
     - Adding specific, testable acceptance criteria
     - Replacing vague actions with specific verbs
     - Ensuring clear business value in benefits
     - Consolidating or expanding thin epics
   - Conservative: only fixes identified issues

8. **UserStoryRefinementPipeline** (`src/analyst/UserStoryRefinementPipeline.ts`)
   - Orchestrates two-pass story generation
   - Methods:
     - `generateWithRefinement()`: Main entry point
     - `needsRefinement()`: Decision logic based on quality score
     - `refineStories()`: Calls larger model with metrics
   - Returns:
     - Final UserStoriesOutput
     - Generated markdown
     - `wasRefined` flag
     - Quality metrics
   - **Includes comprehensive logging** for quality analysis and refinement

### Requirements Refinement Decision Logic

Refinement is triggered if any of these conditions are met:

1. Any actor has zero connections to modules
2. Any key module (Status Tracking, Reporting, Dashboard, Invoice Portal) is orphaned
3. Client/customer actors are connected to non-client-facing modules

### User Story Refinement Decision Logic

Refinement is triggered if any of these conditions are met:

1. Quality score is below 70/100
2. Any stories are missing acceptance criteria
3. Three or more stories have vague actions

Quality score deductions:
- 15 points per story without acceptance criteria
- 10 points per story with vague action
- 10 points per story without sufficient benefit
- 5 points per thin epic (only 1 story)

### Integration

**Route Changes** (`src/routes/analyst.ts`):
- Instantiate both `llmMini` (gpt-4o-mini) and `llmFull` (gpt-4o)
- Create `RequirementsRefinementPipeline` and `UserStoryRefinementPipeline` instances
- Updated `/analyst/extract` endpoint to:
  - Use `refinementPipeline.extractWithRefinement()`
  - Return additional fields: `wasRefined`, `metrics`
- Updated `/analyst/generate-stories` endpoint to:
  - Use `storyRefinementPipeline.generateWithRefinement()`
  - Return additional fields: `wasRefined`, `metrics`
- Updated `/analyst/generate-stories-from-requirements` endpoint to:
  - Use `storyRefinementPipeline.generateWithRefinement()`
  - Return additional fields: `wasRefined`, `metrics`
- Chat and polish endpoints use `llmMini` exclusively

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

4. `tests/UserStoryRefinement.test.ts` (5 tests):
   - Detects stories without acceptance criteria
   - Detects vague actions (manage, handle, use, access)
   - Detects missing or weak benefits
   - Detects epics with few stories
   - Validates quality score calculations

**Test Results**:
- All 27 tests pass
- No regressions introduced
- Mermaid output is properly wrapped and markdown-ready
- User story quality detection works correctly

## Cost/Performance Characteristics

### Requirements Extraction

**Without Issues** (typical case):
- Single gpt-4o-mini call
- Fast and cheap

**With Issues** (refinement triggered):
- First pass: gpt-4o-mini extraction
- Second pass: gpt-4o refinement with diagnostics
- Slower and more expensive, but only when necessary

### User Story Generation

**Without Issues** (typical case):
- Single gpt-4o-mini call
- Quality score >= 70
- Fast and cheap

**With Issues** (refinement triggered):
- First pass: gpt-4o-mini generation
- Second pass: gpt-4o refinement with quality metrics
- Triggered by: missing AC, vague actions, or low quality score
- Slower and more expensive, but improves story quality

## Logging Output

All refinement pipelines now include emoji-prefixed console logging:

**Requirements Extraction**:
```
🚀 [Requirements Extraction] Starting with gpt-4o-mini
📊 [Requirements Analysis] Diagram relationship analysis complete
⚠️  [Requirements] 2 actors with no connections: Client, Wife of Owner
⚠️  [Requirements] 1 key modules orphaned: Workflow Visualization Dashboard
🔄 [Requirements Refinement] Issues detected, refining with gpt-4o
✅ [Requirements Refinement] Complete. Fixed 3 relationship issues
```

**User Story Generation**:
```
🚀 [Story Generation] Starting with gpt-4o-mini
📊 [Story Quality] Score: 55/100
⚠️  [Story Quality] 5 stories missing acceptance criteria
⚠️  [Story Quality] 3 stories with vague actions
🔄 [Story Refinement] Quality issues detected, refining with gpt-4o
✅ [Story Refinement] Complete. New score: 90/100
```

**No Issues** (mini only):
```
🚀 [Requirements Extraction] Starting with gpt-4o-mini
📊 [Requirements Analysis] Diagram relationship analysis complete
✅ [Requirements Extraction] No issues detected, using gpt-4o-mini result
```

## Usage

### Requirements Endpoint

The `/analyst/extract` endpoint now returns:

```typescript
{
  requirements: RequirementsSummary,
  markdown: string,
  mermaid: string,
  wasRefined: boolean,    // indicates if gpt-4o was used
  metrics: MermaidMetrics // diagnostic information
}
```

### User Story Endpoints

Both `/analyst/generate-stories` and `/analyst/generate-stories-from-requirements` now return:

```typescript
{
  userStories: UserStoriesOutput,
  markdown: string,
  wasRefined: boolean,      // indicates if gpt-4o was used
  metrics: UserStoryMetrics // quality diagnostic information
}
```

Frontend can display refinement status and metrics for transparency.

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

