# Error Handling Guidelines

## Overview
This document defines error handling patterns and conventions for the VSol Analyst project.

## Core Principles

### 1. Structured Error Handling
All errors should be handled consistently across the application.

### 2. Error Types
Define custom error types for different scenarios:

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message);
  }
}
```

### 3. Error Logging
Log errors with appropriate context:

```typescript
function logError(error: Error, context: Record<string, unknown> = {}): void {
  console.error('=== ERROR ===');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('Context:', JSON.stringify(context, null, 2));
}
```

### 4. Try-Catch Patterns
Always use try-catch in async route handlers:

```typescript
// Good
router.post("/endpoint", requireAuth, async (req, res) => {
  try {
    const { param } = req.body;
    
    if (!param) {
      return res.status(400).json({ error: "param is required" });
    }
    
    const result = await someAsyncOperation(param);
    res.json({ result });
  } catch (error) {
    logError(error as Error, { path: req.path, method: req.method });
    res.status(500).json({ error: "Operation failed" });
  }
});

// Bad - no try-catch
router.post("/endpoint", async (req, res) => {
  const result = await someAsyncOperation(); // Unhandled promise rejection
  res.json({ result });
});
```

### 5. Resource Cleanup
Always clean up resources in error paths:

```typescript
// Good
try {
  const file = await uploadFile(req.file);
  const result = await processFile(file);
  return res.json({ result });
} catch (error) {
  // Clean up on error
  if (req.file?.path && fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }
  throw error;
}
```

### 6. Input Validation
Validate all inputs at the boundary:

```typescript
function validateProjectName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationError("Project name must be a string");
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Project name cannot be empty");
  }
  
  if (trimmed.length > 100) {
    throw new ValidationError("Project name must be 100 characters or less");
  }
  
  return trimmed;
}
```

### 7. Global Error Handler
Use a centralized error handler as the last middleware:

```typescript
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    logError(err, { path: req.path, user: req.user?.id });
    
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
  
  // Unknown error
  logError(err as Error, { path: req.path, user: req.user?.id });
  
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : (err as Error).message;
    
  res.status(500).json({ error: message });
});
```

### 8. Async Error Wrapper
Create a wrapper for async route handlers:

```typescript
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
router.post("/endpoint", requireAuth, asyncHandler(async (req, res) => {
  const result = await someAsyncOperation();
  res.json({ result });
}));
```

## Patterns to Avoid

### 1. Silent Failures
```typescript
// Bad
try {
  await operation();
} catch {
  // Silent failure
}

// Good
try {
  await operation();
} catch (error) {
  logError(error as Error);
  throw error; // Re-throw or handle appropriately
}
```

### 2. Generic Error Messages
```typescript
// Bad
res.status(500).json({ error: "Error" });

// Good
res.status(500).json({ error: "Failed to create project" });
```

### 3. Exposing Internal Details
```typescript
// Bad - in production
res.status(500).json({ error: error.stack });

// Good
const message = isProd 
  ? "Internal server error" 
  : error.message;
res.status(500).json({ error: message });
```

