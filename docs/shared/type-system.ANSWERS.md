# Type System Guidelines

## Overview
This document defines the type system conventions and patterns for the VSol Analyst project.

## Core Principles

### 1. Strict Type Safety
- Never use `any` type except for external library integration where absolutely necessary
- Use proper TypeScript types and interfaces
- Leverage type inference where appropriate but be explicit when clarity is needed

### 2. Domain Types
Define clear domain types for all business entities:

```typescript
// Good
interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

// Bad - using any
const user: any = req.user;
```

### 3. Request/Response Types
Always define explicit types for API requests and responses:

```typescript
interface CreateProjectRequest {
  name: string;
}

interface CreateProjectResponse {
  project: Project;
}

// Use in handlers
router.post("/", async (req: Request, res: Response) => {
  const { name } = req.body as CreateProjectRequest;
  // ...
});
```

### 4. Type Guards
Use type guards instead of type assertions where possible:

```typescript
// Good
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'email' in obj;
}

// Bad
const user = req.user as User;
```

### 5. Null Safety
- Use strict null checks
- Prefer optional chaining and nullish coalescing
- Validate inputs at boundaries

```typescript
// Good
const userName = user?.name ?? 'Anonymous';

// Bad
const userName = user.name || 'Anonymous'; // Wrong for empty string
```

### 6. Enum Types
Use string literal unions or TypeScript enums:

```typescript
// Good - string literal union
type Priority = 'must-have' | 'should-have' | 'nice-to-have';

// Also good - enum
enum StoryStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE'
}
```

## Common Patterns

### Converting External Types
When working with Prisma or other external types that may have undefined:

```typescript
// Utility function for Prisma JSON fields
function sanitizeForPrisma<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) => 
    value === undefined ? null : value
  ));
}
```

### Type-Safe Error Responses
```typescript
interface ErrorResponse {
  error: string;
  details?: unknown;
}

function sendError(res: Response, status: number, error: string, details?: unknown): void {
  res.status(status).json({ error, details } as ErrorResponse);
}
```

