# Spreadsheet Analysis Feature

## Overview

When you upload an Excel file to the VSol Analyst system, it automatically performs a comprehensive analysis of the spreadsheet structure. This analysis is preserved throughout the conversation and is available when you click "Extract Requirements".

## How It Works

### 1. Upload Analysis

When you upload a spreadsheet, the system:

- Parses all sheets in the workbook
- Extracts the number of rows and columns for each sheet
- Identifies column headers from the first row
- Captures sample data from the first 3 data rows
- Generates a comprehensive summary

Example output format:

```
📊 Excel File: payroll_payoneer_2020-11-01.xlsx

Number of sheets: 3

📄 Sheet: "USD"
Rows: 6
Columns: 6

Column Headers:
  1. 25137822
  2. 2206.3
  3. USD
  4. 1185181-1604322065-1333564
  5. Oct 1 2020 - Oct 31 2020
  6. 44136

Sample Data (first 3 rows):
  Row 2: [40311687,1485.01,"USD","1290297-1604322065-1333564","Oct 1 2020 - Oct 31 2020",44136]
  Row 3: ["tftm1433026",3268.6,"USD","1433026-1604322065-1333564","Oct 1 2020 - Oct 31 2020",44136]
  Row 4: ["tftm1433028",2789.29,"USD","1433028-1604322065-1333564","Oct 1 2020 - Oct 31 2020",44136]
```

### 2. Conversation History

The analysis is added to the chat history as a system message, so:

- Sunny (the AI analyst) can reference the spreadsheet structure in conversation
- The analysis is available for all future messages in the session
- You can ask Sunny questions about the uploaded data

### 3. Requirements Extraction

When you click "Extract Requirements", the system:

1. **Reads the complete chat history** (including spreadsheet analysis)
2. **Uses specialized extraction prompts** that instruct the AI to:
   - Extract every uploaded document detail
   - Create a structured representation of each spreadsheet
   - Generate data entities for each sheet
   - Capture all column names and data patterns

3. **Generates comprehensive output** including:
   - Dedicated "Uploaded Documents and Data Sources" section at the top
   - Sheet-by-sheet breakdown with rows, columns, headers
   - "Data Entities and Structure" section with all fields from spreadsheets
   - Sample data descriptions

## Requirements Output Structure

When you extract requirements after uploading spreadsheets, you'll see:

### Uploaded Documents and Data Sources Section

```markdown
## Uploaded Documents and Data Sources

### payroll_payoneer_2020-11-01.xlsx
**Type:** spreadsheet

**Sheets:**
- **USD**: 6 rows × 6 columns
  - Headers: 25137822, 2206.3, USD, 1185181-1604322065-1333564, Oct 1 2020 - Oct 31 2020, 44136
  - Sample: Employee payment records with amounts, currency, and date ranges
- **BRL**: 8 rows × 6 columns
  - Headers: 25137822, 12672, BRL, 1185181-1604322065-1333564, Oct 1 2020 - Oct 31 2020, 44136
  - Sample: Brazilian Real payment records
- **CURRENCY**: 54 rows × 6 columns
  - Headers: US Dollar▲, 1.00 USD▲▼, inv. 1.00 USD▲▼, Formula, "=ROUND(Currency!$C$6*BRL!B1, 2)"
  - Sample: Currency conversion rates and formulas
```

### Data Entities Section

```markdown
## Data Entities and Structure

### USD Payment Sheet
- 25137822 (Employee/Consultant ID)
- 2206.3 (Amount)
- USD (Currency)
- 1185181-1604322065-1333564 (Transaction ID)
- Oct 1 2020 - Oct 31 2020 (Date Range)
- 44136 (Reference Number)

### BRL Payment Sheet
- 25137822 (Employee/Consultant ID)
- 12672 (Amount)
- BRL (Currency)
- 1185181-1604322065-1333564 (Transaction ID)
- Oct 1 2020 - Oct 31 2020 (Date Range)
- 44136 (Reference Number)

### Currency Conversion Sheet
- US Dollar▲ (Currency Name)
- 1.00 USD▲▼ (Exchange Rate)
- inv. 1.00 USD▲▼ (Inverse Rate)
- Formula (Calculation Formula)
```

## Technical Implementation

### Data Structure

The system uses the following TypeScript interfaces:

```typescript
interface UploadedDocumentSheet {
  name: string;
  rows: number;
  columns: number;
  headers: string[];
  sampleData: string;
}

interface UploadedDocument {
  filename: string;
  type: "spreadsheet" | "image" | "document";
  summary: string;
  sheets?: UploadedDocumentSheet[];
}

interface RequirementsSummary {
  // ... other fields
  dataEntities: DataEntity[];
  uploadedDocuments: UploadedDocument[];
}
```

### Files Modified

1. **src/analyst/RequirementsTypes.ts** - Added UploadedDocument and UploadedDocumentSheet interfaces
2. **src/analyst/prompts.ts** - Enhanced extraction prompt with explicit instructions for spreadsheet analysis
3. **src/analyst/DocumentGenerator.ts** - Added "Uploaded Documents and Data Sources" section to output
4. **src/analyst/RequirementsExtractor.ts** - Added safety check for uploadedDocuments array

### Existing Files (Already Working)

1. **src/server.ts** - Already parses Excel files and creates detailed summaries (lines 646-698)
2. **src/server.ts** - Already stores spreadsheet analysis in chat history (lines 729-739)

## Guarantees

When you click "Extract Requirements", the system **guarantees**:

1. All spreadsheet files uploaded during the conversation are included
2. Each sheet's structure (rows, columns, headers) is documented
3. Sample data is described to show patterns and content
4. Data entities are created for each sheet with all column names
5. The original analysis format is preserved in the summary

## What Gets Captured

For each spreadsheet:
- ✅ Filename
- ✅ Number of sheets
- ✅ Sheet names
- ✅ Row and column counts per sheet
- ✅ All column headers (first row)
- ✅ Sample data from first 3 rows
- ✅ Data patterns and types inferred from samples

## Best Practices

1. **Upload spreadsheets early** in the conversation so Sunny can reference them
2. **Use descriptive sheet names** - they appear in the requirements
3. **Include headers** in row 1 of each sheet for accurate analysis
4. **Discuss the spreadsheet** with Sunny to provide context about what each field means
5. **Multiple uploads** - You can upload multiple spreadsheets, each will be analyzed separately

## Troubleshooting

If spreadsheet analysis doesn't appear in requirements:

1. Check that the file was successfully uploaded (Sunny should acknowledge it)
2. Verify the file format is .xls or .xlsx
3. Ensure the spreadsheet has data (not empty sheets)
4. Check the chat history includes the analysis summary
5. Review the browser console for any upload errors

## Example Flow

1. User uploads `payroll_data.xlsx`
2. System analyzes: 3 sheets, 100+ rows, 12 columns total
3. Summary is added to chat history with full details
4. User discusses the data with Sunny
5. User clicks "Extract Requirements"
6. Output includes:
   - "Uploaded Documents and Data Sources" section with sheet details
   - "Data Entities and Structure" with all 12 field names
   - Context from the conversation about what the data represents

## Result

Every spreadsheet analysis is captured, preserved, and included in your requirements document automatically. No manual copying or re-entry needed.

