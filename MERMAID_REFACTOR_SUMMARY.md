# Mermaid Workflow Diagram Refactoring - Implementation Complete

## Summary

Successfully refactored the Mermaid workflow diagram generator from a naive "connect everything to everything" approach to a sophisticated scoring-based relationship inference system.

## Implementation Checklist

### ✅ 1. Configuration & Documentation
- Added top-level constants (ROLE_SYNONYMS, STOPWORDS, DEFAULT_SCORE_THRESHOLD, MAX_SCORE)
- Added comprehensive philosophy documentation
- Added RequirementsSummary expectations documentation

### ✅ 2. Constructor Updates
- Added `scoreThreshold` parameter (default: 2) for tunable edge creation
- Added `simpleMode` parameter (default: false) as debugging escape hatch

### ✅ 3. Text Processing Helpers (4 methods)
- `normalizeText()`: Converts text to normalized word sets with stopword filtering
- `isStrongKeywordMatch()`: Exact keyword matching
- `isWeakKeywordMatch()`: Substring matching with length guards (min 4 chars)
- `hasAnyCommonWord()`: Set intersection check

### ✅ 4. Domain Logic Helpers (5 methods)
- `makeIdFromName()`: Unique Mermaid ID generation with collision handling
- `extractActorKeywords()`: Role-based synonym expansion
- `scoreActorModuleRelation()`: Pure scoring function (0-9 points)
- `actorUsesModule()`: Boolean wrapper around scoring
- `findBestFallbackModule()`: Fallback selection for isolated actors

### ✅ 5. generateMermaidFlow Refactoring
Complete rewrite with:
- Simple mode escape hatch for debugging
- Debug mode with score legend (environment-gated)
- Deterministic sorted output
- Single-pass normalization with caching
- Actor keyword caching
- Smart edge generation based on scoring
- External tool integration
- Safety nets for missing data
- Graceful handling of partial extraction

### ✅ 6. Test Suite
Created comprehensive test file with 5 test cases:
1. Consulting/Invoices Domain - Verifies correct actor-module relationships
2. E-commerce Domain - Tests generalization across domains
3. No Clear Relationships - Validates threshold prevents spurious connections
4. Custom Threshold Tests - Confirms tunable behavior
5. Simple Mode Test - Verifies debugging mode works

### ✅ 7. Test Infrastructure
- Installed Jest with TypeScript support
- Created jest.config.js
- Added test scripts to package.json
- All 5 tests passing ✓

## Key Improvements

### Before
- Naive full bipartite graph (every actor → every module)
- No semantic understanding
- Useless for real-world requirements

### After
- Intelligent relationship inference using scoring
- Primary signals: module name + description
- Secondary signals: pain points mentioning both actor and module
- Tertiary signals: goals with weak alignment
- Tunable threshold (default: 2)
- Fallback strategy for isolated actors
- Debug mode for tuning
- Simple mode for sanity checks
- Deterministic output for stable diffs
- Comprehensive test coverage

## Scoring System

Relationships scored 0-9 based on:
1. Module description match (0-2 points)
2. Module name match (0-2 points)
3. Pain points mentioning both (0-2 points)
4. Goals alignment (0-2 points)
5. Priority boost for must-have modules (0-1 point)

Edges drawn when score ≥ threshold (default: 2)

## Future-Proofing

- Externalized role synonyms (easy to extend)
- Pure, testable scoring function
- Comments for future enhancements (tool direction, primaryGoal weighting)
- Constructor parameters for tuning without code changes
- Safety nets throughout (missing data, collisions)

## Verification

✅ TypeScript compilation successful
✅ All tests passing (5/5)
✅ No linting errors
✅ Backward compatible (existing code uses default constructor)
✅ Production-ready

## Files Modified

1. `src/analyst/DocumentGenerator.ts` - Complete refactoring (~590 lines)
2. `tests/DocumentGenerator.mermaid.test.ts` - New test file (~240 lines)
3. `jest.config.js` - New Jest configuration
4. `package.json` - Added test scripts and Jest dependencies

## Usage

### Default (Production)
```typescript
const generator = new DocumentGenerator();
const mermaid = generator.generateMermaidFlow(requirements);
```

### Custom Threshold
```typescript
const generator = new DocumentGenerator(3); // Higher threshold = fewer edges
const mermaid = generator.generateMermaidFlow(requirements);
```

### Debug Mode
```bash
MERMAID_DEBUG_RELATIONS=true NODE_ENV=development npm run dev
```

### Simple Mode (Debugging)
```typescript
const generator = new DocumentGenerator(2, true);
const mermaid = generator.generateMermaidFlow(requirements);
```

## Next Steps (Optional Enhancements)

1. Add `intendedUsers` field to CandidateModule for explicit relationships
2. Add tool direction support (in/out/both)
3. Give primaryGoal extra weight in scoring
4. Add more role synonyms based on domain feedback
5. Consider visual styling (different edge types for different relationships)

## Polish Refinements Applied

### DocumentGenerator Refinements

After initial implementation, the following refinements were applied for production readiness:

1. **Fixed user stories priority line** - Concatenates metadata on single line instead of multiple lines
2. **Removed unused `actorScores` map** - Cleaner, more focused per-actor scoring
3. **Removed unused `actorUsesModule` method** - Direct scoring comparison is clearer
4. **ID consistency in simple mode** - Uses `makeIdFromName` for uniform ID generation
5. **Guards against undefined** - Module priority and description have fallback values
6. **Numeric token filtering** - `normalizeText` filters out purely numeric tokens (IDs, dates)
7. **MAX_SCORE alignment** - Updated to 8 with comment explaining current weight sum
8. **Future-proofing comment** - `findBestFallbackModule` actor param documented for future use
9. **Early return optimization** - Simplified "no modules" case with early exit

All refinements maintain backward compatibility and test coverage (5/5 tests passing).

### Server.ts Production Hardening

Applied practical production-ready improvements to the server:

1. **Replaced body-parser with express.json()** - Removed unnecessary dependency, using built-in Express middleware
2. **Enhanced session security** - Added httpOnly, secure (prod), sameSite cookies; trust proxy for HTTPS behind reverse proxy
3. **Tightened error handler** - More specific pattern matching for file filter errors ("Only ... files ... are allowed")
4. **Production error message safety** - Avoids leaking internal error details on 500s in production
5. **Better error handler typing** - Changed from `any` to `unknown` with proper type narrowing
6. **Configurable port** - Supports PORT environment variable for deployment flexibility
7. **Graceful shutdown comments** - Added TODOs for proper shutdown behavior in production

Dependencies cleaned:
- Removed `body-parser` from dependencies
- Removed `@types/body-parser` from devDependencies

### Business Logic Refinements (Round 2)

Applied targeted improvements based on real-world diagram output:

1. **Skip client fallback edges** - External actors (client/customer/user) no longer get spurious fallback connections unless score ≥ 2
2. **Management-module affinity** - Owners, managers, directors, accountants get +1 bonus for reporting/analytics/dashboard/status modules
3. **Wife co-management recognition** - "Wife of Owner" detected and treated as management role for reporting/analytics access
4. **Updated MAX_SCORE to 9** - Reflects new management affinity weight: desc(2) + name(2) + pain(2) + goals(1) + priority(1) + mgmt(1)
5. **Added real-world test** - Comprehensive test covering client roles, management affinity, and status tracking modules

New constants added:
- `MANAGEMENT_ROLES` = ["owner", "manager", "director", "accountant"]
- `MANAGEMENT_MODULE_KEYWORDS` = ["report", "analytics", "dashboard", "status"]
- `CLIENT_ROLES` = ["client", "customer", "user"]

All refinements maintain backward compatibility. Test coverage: 6/6 tests passing.

Example improvement:
- Before: `client_omnigo --> automated_reminders   %% fallback` ❌
- After: Client has no edges (correct behavior) ✅
- Before: Owner not connected to "Status Tracking"
- After: `owner --> status_tracking` ✅

### System Prompt Refinement (Upstream Fix)

Updated `SYSTEM_PROMPT_EXTRACTOR` in `src/analyst/prompts.ts` to improve RequirementsSummary quality upstream:

**Key improvements:**
1. **Explicit module naming in actor descriptions** - Actors now explicitly mention which modules they use
2. **Detailed module guidance** - Special instructions for each module type (Dashboard, Status Tracking, Integration modules, etc.)
3. **Integration vs user-facing distinction** - Integration modules described as backend/system-level to prevent spurious Owner → Integration edges
4. **Client role clarification** - Clear guidance that clients don't use internal modules unless explicit client portal exists
5. **Tool connection specificity** - Only connect tools where they truly integrate, not randomly everywhere

**Specific examples added:**
- Workflow Visualization Dashboard → explicitly for Owner/Wife management use
- Status Tracking → both management and consultants, with clear use cases
- Integration with Time Tracking Tools → backend system integration, not user-facing
- Currency Management → Owner-specific with tool connections (Payoneer, bank account)
- Client Portal → distinct from internal modules

This upstream fix ensures the extractor produces actor/module descriptions that make relationships obvious to the keyword-based scorer, eliminating issues like:
- ❌ Orphaned workflow dashboard (now explicitly mentions Owner/Wife as users)
- ❌ Owner connected to integration modules (now described as backend-only)
- ❌ Weak tool-module connections (now explicit about which tools integrate where)

---

**Status**: ✅ Implementation Complete, Tested, Polished, Business-Logic Refined, and Prompt-Enhanced
**Date**: November 9, 2025

