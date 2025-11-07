# Spreadsheet Analysis Test Scenario

## Test Case: Payroll System Requirements

### Step 1: Upload Spreadsheet

When you upload `payroll_payoneer_2020-11-01.xlsx`, the system automatically adds this to the chat history:

```
[SYSTEM: User uploaded a spreadsheet file]

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

📄 Sheet: "BRL"
Rows: 8
Columns: 6

Column Headers:
  1. 25137822
  2. 12672
  3. BRL
  4. 1185181-1604322065-1333564
  5. Oct 1 2020 - Oct 31 2020
  6. 44136

Sample Data (first 3 rows):
  Row 2: [40311687,8529.24,"BRL","1290297-1604322065-1333564","Oct 1 2020 - Oct 31 2020",44136]
  Row 3: ["tftm1433026",18773.4,"BRL","1433026-1604322065-1333564","Oct 1 2020 - Oct 31 2020",44136]
  Row 4: ["tftm1433028",16020.44,"BRL","1433028-1604322065-1333564","Oct 1 2020 - Oct 31 2020",44136]

📄 Sheet: "CURRENCY"
Rows: 54
Columns: 6

Column Headers:
  1. US Dollar▲
  2. 1.00 USD▲▼
  3. inv. 1.00 USD▲▼
  5. Formula
  6. "=ROUND(Currency!$C$6*BRL!B1, 2)"

Sample Data (first 3 rows):
  Row 2: ["Argentine Peso",78.643631,0.012716,null,"Brazilian Real"]
  Row 3: ["Australian Dollar",1.419343,0.704551]
  Row 4: ["Bahraini Dinar",0.376,2.659574]
```

### Step 2: Sunny Acknowledges

Sunny responds with something like:

> "Thank you for uploading the payroll spreadsheet! I can see you have:
> - USD payment records with 6 rows
> - BRL payment records with 8 rows  
> - A currency conversion table with 54 entries
> 
> Can you tell me more about how you currently process these payments?"

### Step 3: Conversation Continues

You discuss:
- Who receives these payments
- How often payments are made
- What problems exist with the current process
- What you'd like to automate

### Step 4: Extract Requirements

When you click "Extract Requirements", the system:

1. Reads the entire chat history (including the spreadsheet analysis from Step 1)
2. Uses the enhanced extraction prompts that explicitly say:
   - "Add an entry to uploadedDocuments for EACH uploaded file"
   - "Extract the filename exactly as shown"
   - "Include the full summary text that was provided"
   - "For spreadsheets, populate the sheets array with name, rows, columns, headers, sampleData"
3. The LLM extracts everything into structured format

### Step 5: Generated Requirements Document

The markdown output includes:

```markdown
# System Requirements

**Client:** Your Company Name
**Industry:** Consulting / Professional Services
**Region:** Global

## Primary Goal
Build a payroll management system that processes multi-currency payments to consultants...

## Secondary Goals
- Automate payment calculations
- Support multiple currencies (USD, BRL)
- Track payment history
- Generate reports

## Uploaded Documents and Data Sources

### payroll_payoneer_2020-11-01.xlsx
**Type:** spreadsheet

**Sheets:**
- **USD**: 6 rows × 6 columns
  - Headers: 25137822, 2206.3, USD, 1185181-1604322065-1333564, Oct 1 2020 - Oct 31 2020, 44136
  - Sample: Payment records showing consultant IDs, payment amounts in USD, transaction IDs, and date ranges
- **BRL**: 8 rows × 6 columns
  - Headers: 25137822, 12672, BRL, 1185181-1604322065-1333564, Oct 1 2020 - Oct 31 2020, 44136
  - Sample: Payment records showing consultant IDs, payment amounts in Brazilian Real, transaction IDs, and date ranges
- **CURRENCY**: 54 rows × 6 columns
  - Headers: US Dollar▲, 1.00 USD▲▼, inv. 1.00 USD▲▼, Formula, "=ROUND(Currency!$C$6*BRL!B1, 2)"
  - Sample: Currency conversion rates with formulas for various currencies including Argentine Peso, Australian Dollar, Bahraini Dinar

**Summary:**
📊 Excel File: payroll_payoneer_2020-11-01.xlsx

Number of sheets: 3

📄 Sheet: "USD"
Rows: 6
Columns: 6
...
[Full analysis included]

## Current Tools and Systems
- Microsoft Excel for payroll data
- Payoneer for payment processing
- Manual currency conversion

## Users and Roles
- **Payroll Administrator**: Manages payment processing and record keeping
- **Finance Manager**: Reviews and approves payments
- **Consultants**: Receive payments in various currencies

## Pain Points
- Manual data entry from spreadsheets is time-consuming (impact: high, frequency: often)
- Currency conversion requires manual lookup and calculation (impact: medium, frequency: often)
- Tracking payment history across multiple sheets is difficult (impact: medium, frequency: sometimes)

## Data Entities and Structure

### USD Payments
- Consultant ID (25137822, 40311687, etc.)
- Payment Amount (decimal, e.g., 2206.3, 1485.01)
- Currency Code (USD)
- Transaction ID (format: xxxxxxx-xxxxxxxxxx-xxxxxxx)
- Payment Period (text, e.g., "Oct 1 2020 - Oct 31 2020")
- Reference Number (integer, 44136)

### BRL Payments
- Consultant ID (25137822, 40311687, etc.)
- Payment Amount (decimal, e.g., 12672, 8529.24)
- Currency Code (BRL)
- Transaction ID (format: xxxxxxx-xxxxxxxxxx-xxxxxxx)
- Payment Period (text, e.g., "Oct 1 2020 - Oct 31 2020")
- Reference Number (integer, 44136)

### Currency Conversion Rates
- Currency Name (text with sort indicators, e.g., "US Dollar▲")
- Exchange Rate to USD (decimal)
- Inverse Exchange Rate (decimal)
- Conversion Formula (Excel formula string)
- Related Currency Name (optional text)

## Candidate Modules
- **Payment Processing Module** (must-have) - Process multi-currency payments to consultants with automated currency conversion
- **Payment History Dashboard** (must-have) - View all payment records with filtering by date, currency, and consultant
- **Currency Converter** (must-have) - Automatically fetch and apply current exchange rates
- **Consultant Management** (should-have) - Maintain consultant profiles with preferred payment currency
- **Report Generator** (should-have) - Generate monthly payment reports by currency and consultant
- **Excel Import** (should-have) - Import payment data from existing Excel files
- **Payoneer Integration** (nice-to-have) - Direct integration with Payoneer API for payment execution

## Non Functional Needs
- Must support at least 54 different currencies
- Payment calculations must be accurate to 2 decimal places
- System should handle monthly payment volumes of 50+ transactions
- Must maintain audit trail of all payments

## Risks and Constraints
- Integration with Payoneer API depends on available API access (type: technical)
- Currency exchange rates must be updated regularly for accuracy (type: technical)
- Existing Excel data needs to be migrated without data loss (type: technical)

## Open Questions
- What is the preferred frequency for currency rate updates (daily, hourly)?
- Should the system support additional payment providers beyond Payoneer?
- Are there specific compliance or regulatory requirements for international payments?
- What level of access should consultants have to view their payment history?
```

## Verification Checklist

When testing, verify:

- [ ] Uploaded Documents section appears near the top of requirements
- [ ] All 3 sheets are listed with correct row/column counts
- [ ] All column headers are captured exactly as they appear
- [ ] Sample data descriptions are included
- [ ] Data Entities section includes all fields from all sheets
- [ ] Field names match the headers from the spreadsheet
- [ ] The full summary text is preserved in the Uploaded Documents section

## Key Points

1. **Automatic Analysis**: Upload triggers immediate parsing
2. **Preserved in History**: Analysis stored in chat for context
3. **Always Extracted**: Requirements include dedicated section for uploads
4. **Structured Output**: Sheet-by-sheet breakdown with all details
5. **Data Entities**: Separate section shows field-level detail

## Result

Every detail from your spreadsheet is captured and available in the extracted requirements. Nothing is lost or needs to be manually re-entered.

