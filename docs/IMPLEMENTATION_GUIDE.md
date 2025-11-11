# Implementation Guide for Refactored Code

## Quick Start

The codebase has been refactored to follow SonarQube-quality standards. This guide helps you understand the new patterns and how to use them.

## Environment Setup

### Required Environment Variables
The application will now fail fast if required environment variables are missing:

```bash
SESSION_SECRET=your-session-secret-here
OPENAI_API_KEY=your-openai-api-key
NODE_ENV=development # or production
PORT=5051 # optional, defaults to 5051
```

## New Patterns and Utilities

### 1. Route Handler Pattern

All routes now follow this consistent pattern:

```typescript
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../utils/async-handler";
import { getAuthenticatedUser } from "../utils/prisma-helpers";
import { validateProjectName } from "../utils/validation";
import { NotFoundError } from "../utils/errors";
import { prisma } from "../utils/prisma";

const router = Router();

router.post("/example", requireAuth, asyncHandler(async (req, res) => {
  // 1. Get and validate user
  const user = getAuthenticatedUser(req.user);
  
  // 2. Validate inputs
  const name = validateProjectName(req.body.name);
  
  // 3. Perform business logic
  const result = await performOperation(name, user.id);
  
  // 4. Return response
  res.json({ result });
}));

export default router;
```

Key points:
- Use `asyncHandler` wrapper - no more try-catch in every route
- Use `getAuthenticatedUser()` for type-safe user access
- Use validation utilities for input checking
- Throw custom errors (they'll be caught and handled properly)

### 2. Error Handling

Use custom error classes instead of manual status codes:

```typescript
import { NotFoundError, ValidationError, ForbiddenError } from "../utils/errors";

// Instead of:
if (!project) {
  return res.status(404).json({ error: "Project not found" });
}

// Use:
if (!project) {
  throw new NotFoundError("Project");
}

// Validation errors:
if (!input || typeof input !== "string") {
  throw new ValidationError("Input must be a string");
}

// Access control:
if (project.ownerId !== user.id) {
  throw new ForbiddenError("You don't own this project");
}
```

### 3. Database Access

Always use the singleton Prisma instance:

```typescript
// GOOD
import { prisma } from "../utils/prisma";

const users = await prisma.user.findMany();

// BAD - Don't create new PrismaClient instances
const prisma = new PrismaClient(); // ❌
```

### 4. Input Validation

Use the validation utilities:

```typescript
import { validateProjectName, validateTextInput, validateUUID } from "../utils/validation";

// Validates and returns sanitized string
const projectName = validateProjectName(req.body.name); // throws ValidationError if invalid

// For text content
const text = validateTextInput(req.body.text); // max 10K chars

// For UUIDs
const id = validateUUID(req.params.id); // validates format
```

### 5. Prisma JSON Fields

When storing data in Prisma JSON fields:

```typescript
import { sanitizeForPrisma } from "../utils/prisma-helpers";

// Convert undefined to null for Prisma
const data = sanitizeForPrisma({
  field1: "value",
  field2: undefined, // becomes null
  nested: {
    field3: undefined // also becomes null
  }
});

await prisma.model.create({ data });
```

### 6. Attachment Resolution

Use the helper function instead of duplicating code:

```typescript
import { createAttachmentResolver } from "../utils/attachment-helpers";

const resolveAttachment = createAttachmentResolver();

const reply = await llm.chat({
  messages: history,
  resolveAttachment, // automatically resolves attachment:// URLs
});
```

### 7. Server-Sent Events (SSE)

Use the SSE helpers for progress streaming:

```typescript
import { 
  configureSSEHeaders, 
  sendSSEProgress, 
  sendSSEData, 
  sendSSEError,
  delay
} from "../utils/sse-helpers";

router.post("/operation", requireAuth, async (req, res) => {
  configureSSEHeaders(res);
  
  try {
    sendSSEProgress(res, 10, "Starting...");
    await delay(1000);
    
    sendSSEProgress(res, 50, "Processing...");
    const result = await performOperation();
    
    sendSSEProgress(res, 100, "Complete");
    sendSSEData(res, { result });
  } catch (error) {
    sendSSEError(res, "Operation failed");
  }
});
```

### 8. Project Helpers

Common project operations:

```typescript
import { 
  verifyProjectOwnership,
  getOrCreateChatSession,
  updateChatSessionHistory
} from "../utils/project-helpers";

// Verify user owns project (throws NotFoundError if not)
await verifyProjectOwnership(projectId, user.id);

// Get or create chat session
const session = await getOrCreateChatSession(projectId, userFirstName);

// Update chat history (automatically sanitizes)
await updateChatSessionHistory(session.id, history);
```

### 9. Constants

Use constants instead of magic numbers:

```typescript
import * as constants from "../utils/constants";

// File sizes
limits: { fileSize: constants.MAX_FILE_SIZE }

// MIME types
if (constants.ALLOWED_IMAGE_MIMES.includes(file.mimetype as any)) {
  // ...
}

// Temperatures
temperature: constants.DEFAULT_TEMPERATURE_CHAT

// Delays
await delay(constants.PROGRESS_DELAY_MEDIUM);
```

## Common Tasks

### Adding a New Route

1. Create route handler:

```typescript
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../utils/async-handler";
import { getAuthenticatedUser } from "../utils/prisma-helpers";
import { prisma } from "../utils/prisma";

const router = Router();

router.post("/my-route", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  // ... your logic
  res.json({ result });
}));

export default router;
```

2. Register in `src/server.ts`:

```typescript
import myRoutes from "./routes/my-routes";
app.use("/api/my", myRoutes);
```

### Adding Input Validation

1. Add to `src/utils/validation.ts`:

```typescript
export function validateMyInput(input: unknown): string {
  if (typeof input !== "string") {
    throw new ValidationError("Input must be a string");
  }
  
  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError("Input cannot be empty");
  }
  
  if (trimmed.length > 1000) {
    throw new ValidationError("Input must be 1000 characters or less");
  }
  
  return trimmed;
}
```

2. Use in routes:

```typescript
const input = validateMyInput(req.body.input);
```

### Adding Custom Error Type

1. Add to `src/utils/errors.ts`:

```typescript
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}
```

2. Use in routes:

```typescript
import { ConflictError } from "../utils/errors";

if (existingResource) {
  throw new ConflictError("Resource already exists");
}
```

## Migration Guide

### If You Have Existing Code

1. **Replace PrismaClient instances**:
   ```typescript
   // Old
   const prisma = new PrismaClient();
   
   // New
   import { prisma } from "../utils/prisma";
   ```

2. **Wrap async handlers**:
   ```typescript
   // Old
   router.post("/route", requireAuth, async (req, res) => {
     try {
       // ...
     } catch (error) {
       res.status(500).json({ error: "Failed" });
     }
   });
   
   // New
   router.post("/route", requireAuth, asyncHandler(async (req, res) => {
     // ... no try-catch needed
   }));
   ```

3. **Replace user assertions**:
   ```typescript
   // Old
   const user = req.user as any;
   
   // New
   const user = getAuthenticatedUser(req.user);
   ```

4. **Replace manual validation**:
   ```typescript
   // Old
   if (!name || typeof name !== "string") {
     return res.status(400).json({ error: "name required" });
   }
   
   // New
   const name = validateProjectName(req.body.name); // throws ValidationError
   ```

5. **Replace error responses**:
   ```typescript
   // Old
   if (!project) {
     return res.status(404).json({ error: "Not found" });
   }
   
   // New
   if (!project) {
     throw new NotFoundError("Project");
   }
   ```

## Best Practices

### DO:
- ✅ Use `asyncHandler` for all async routes
- ✅ Use validation utilities for input checking
- ✅ Throw custom error classes
- ✅ Use the singleton Prisma instance
- ✅ Use type guards and proper TypeScript types
- ✅ Use constants for magic numbers
- ✅ Log errors with context using `logError()`
- ✅ Clean up resources (files) in error paths

### DON'T:
- ❌ Create new `PrismaClient()` instances
- ❌ Use `as any` type assertions (use type guards instead)
- ❌ Return `res.status(500)` manually (throw errors instead)
- ❌ Hardcode secrets or use fallback values
- ❌ Duplicate code (extract to utilities)
- ❌ Use magic numbers (use constants)
- ❌ Silently catch errors
- ❌ Forget to validate inputs at boundaries

## Testing

The new structure is more testable:

```typescript
// Test utility functions in isolation
import { validateProjectName } from "../utils/validation";

test("validates project name", () => {
  expect(() => validateProjectName("")).toThrow("cannot be empty");
  expect(validateProjectName("  test  ")).toBe("test");
});

// Test route handlers with mocked dependencies
import { getAuthenticatedUser } from "../utils/prisma-helpers";

jest.mock("../utils/prisma-helpers");

test("route requires authenticated user", async () => {
  (getAuthenticatedUser as jest.Mock).mockReturnValue({
    id: "user-123",
    email: "test@example.com",
    name: "Test User"
  });
  
  // ... test route
});
```

## Troubleshooting

### "Missing required environment variable"
Set all required environment variables in your `.env` file:
```bash
SESSION_SECRET=your-secret
OPENAI_API_KEY=your-key
```

### TypeScript Errors
Run type checking:
```bash
npx tsc --noEmit
```

### "Cannot find module"
Make sure imports use relative paths:
```typescript
// Correct
import { prisma } from "../utils/prisma";

// Wrong
import { prisma } from "utils/prisma";
```

## References

- [Type System Guidelines](./shared/type-system.ANSWERS.md)
- [Error Handling Guidelines](./shared/error-handling.ANSWERS.md)
- [Refactoring Summary](./SONARQUBE_REFACTORING_SUMMARY.md)

