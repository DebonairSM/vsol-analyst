/**
 * Escape SQL identifier (table name, column name) to prevent SQL injection.
 * Only allows alphanumeric characters and underscores.
 * @param identifier - The identifier to escape
 * @returns Escaped identifier safe for SQL
 */
export function escapeSQLIdentifier(identifier: string): string {
  // Remove all non-alphanumeric characters except underscore
  const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(cleaned)) {
    return `_${cleaned}`;
  }
  
  // Ensure it's not empty
  if (!cleaned) {
    throw new Error("Invalid SQL identifier: empty after sanitization");
  }
  
  return cleaned;
}

/**
 * Escape SQL string value to prevent SQL injection.
 * Properly escapes single quotes and handles NULL values.
 * @param value - The value to escape
 * @returns Escaped SQL string value
 */
export function escapeSQLValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number') {
    // Validate number is finite
    if (!Number.isFinite(value)) {
      return 'NULL';
    }
    return String(value);
  }
  
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  
  // Convert to string and escape single quotes
  const stringValue = String(value);
  
  // Escape single quotes by doubling them (SQL standard)
  // Also escape backslashes to prevent issues
  const escaped = stringValue
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''");
  
  return `'${escaped}'`;
}

/**
 * Generate safe SQL INSERT statement.
 * @param tableName - Table name (will be sanitized)
 * @param columns - Array of column names (will be sanitized)
 * @param values - Array of row values (will be escaped)
 * @returns Safe SQL INSERT statement
 */
export function generateSafeSQLInsert(
  tableName: string,
  columns: string[],
  values: unknown[][]
): string {
  const safeTableName = escapeSQLIdentifier(tableName);
  const safeColumns = columns.map(escapeSQLIdentifier);
  const safeValues = values.map(row => 
    row.map(escapeSQLValue).join(', ')
  );
  
  const inserts = safeValues.map(rowValues => 
    `INSERT INTO ${safeTableName} (${safeColumns.join(', ')}) VALUES (${rowValues});`
  );
  
  return inserts.join('\n');
}

