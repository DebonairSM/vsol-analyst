# Refinement Implementation Summary

## What Was Implemented

### Three Refinement Pipelines with Logging

1. **Requirements Extraction** (`/analyst/extract`)
   - Uses gpt-4o-mini by default
   - Auto-refines with gpt-4o when diagram relationships are problematic
   - Returns `wasRefined` flag and `metrics` object
   - **Comprehensive logging** tracks model usage and issues found

2. **User Story Generation** (`/analyst/generate-stories` and `/analyst/generate-stories-from-requirements`)
   - Uses gpt-4o-mini by default
   - Auto-refines with gpt-4o when story quality is poor
   - Returns `wasRefined` flag and `metrics` object
   - **Comprehensive logging** tracks quality scores and refinement

3. **Chat** (`/analyst/chat`)
   - Always uses gpt-4o-mini (unless images present → auto-upgrades to gpt-4o)
   - No refinement pipeline (direct streaming response)

## How to Know Which Model Was Used

### 1. Check the Response Data

All refinement endpoints return a `wasRefined` boolean:

```javascript
const response = await fetch('/analyst/extract', { ... });
const data = await response.json();

if (data.wasRefined) {
  console.log('🔄 Used gpt-4o for refinement');
  console.log('Issues found:', data.metrics);
} else {
  console.log('✅ Used gpt-4o-mini only');
}
```

### 2. Check Server Logs

The server console now shows detailed emoji-prefixed logs:

**Requirements** (no issues):
```
🚀 [Requirements Extraction] Starting with gpt-4o-mini
📊 [Requirements Analysis] Diagram relationship analysis complete
✅ [Requirements Extraction] No issues detected, using gpt-4o-mini result
```

**Requirements** (with issues):
```
🚀 [Requirements Extraction] Starting with gpt-4o-mini
📊 [Requirements Analysis] Diagram relationship analysis complete
⚠️  [Requirements] 2 actors with no connections: Client, Wife of Owner
⚠️  [Requirements] 1 key modules orphaned: Workflow Visualization Dashboard
🔄 [Requirements Refinement] Issues detected, refining with gpt-4o
✅ [Requirements Refinement] Complete. Fixed 3 relationship issues
```

**User Stories** (no issues):
```
🚀 [Story Generation] Starting with gpt-4o-mini
📊 [Story Quality] Score: 85/100
✅ [Story Generation] Quality acceptable, using gpt-4o-mini result
```

**User Stories** (with issues):
```
🚀 [Story Generation] Starting with gpt-4o-mini
📊 [Story Quality] Score: 55/100
⚠️  [Story Quality] 5 stories missing acceptance criteria
⚠️  [Story Quality] 3 stories with vague actions
🔄 [Story Refinement] Quality issues detected, refining with gpt-4o
✅ [Story Refinement] Complete. New score: 90/100
```

### 3. Inspect the Metrics Object

**Requirements metrics**:
```javascript
{
  actorsWithNoConnections: ["Client", "Wife of Owner"],
  modulesWithNoConnections: [],
  suspiciousClientEdges: [],
  keyModulesMissingOrOrphaned: ["Workflow Visualization Dashboard"]
}
```

**User Story metrics**:
```javascript
{
  storiesWithoutAcceptanceCriteria: ["US-001", "US-003", "US-005"],
  storiesWithVagueActions: ["US-002", "US-007"],
  storiesWithoutBenefits: ["US-001"],
  epicsWithFewStories: ["Edge Case Features"],
  totalQualityScore: 55
}
```

## Refinement Triggers

### Requirements Refinement

Triggered when ANY of:
- Actors with no module connections
- Key modules (Status Tracking, Reporting, Dashboard, Invoice Portal) are orphaned
- Client actors connected to non-client-facing modules

### User Story Refinement

Triggered when ANY of:
- Quality score < 70/100
- ANY stories missing acceptance criteria
- 3+ stories with vague actions (manage, handle, use, access)

## Testing

- **27 tests pass** (4 test suites)
- Covers requirements refinement, user story quality, mermaid validation
- All builds complete successfully
- No regressions

## Cost Optimization

- **Typical case**: gpt-4o-mini only (fast, cheap)
- **Problem case**: gpt-4o-mini + gpt-4o refinement (slower, more expensive, but better quality)
- Refinement only happens when diagnostics detect actual issues
- Saves money by using mini model whenever possible

## Files Created/Modified

**New Files**:
- `src/analyst/RequirementsRefinementPipeline.ts`
- `src/analyst/UserStoryRefinementPipeline.ts`
- `tests/RequirementsRefinementPipeline.test.ts`
- `tests/UserStoryRefinement.test.ts`
- `tests/MermaidOutputValidation.test.ts`

**Modified Files**:
- `src/analyst/DocumentGenerator.ts` - Added metrics and diagnostics
- `src/analyst/StoryGenerator.ts` - Added quality analysis
- `src/analyst/prompts.ts` - Added refiner prompts
- `src/routes/analyst.ts` - Integrated refinement pipelines
- `tests/DocumentGenerator.mermaid.test.ts` - Updated for mermaid wrapper

## Next Steps

### Frontend Integration

Display refinement status in the UI:

```javascript
// After extraction
if (data.wasRefined) {
  showNotification('Requirements refined with gpt-4o for better quality');
}

// Show metrics for debugging
if (data.metrics.actorsWithNoConnections.length > 0) {
  console.warn('Orphaned actors:', data.metrics.actorsWithNoConnections);
}
```

### Monitoring

Track refinement frequency to understand:
- How often the larger model is needed
- Cost implications
- Quality improvements over time

Add to your analytics:
```javascript
analytics.track('requirements_extracted', {
  wasRefined: data.wasRefined,
  issueCount: data.metrics.actorsWithNoConnections.length + 
              data.metrics.modulesWithNoConnections.length
});
```

