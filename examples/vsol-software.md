# System Requirements

**Client:** Consulting Company
**Industry:** Consulting

## Primary Goal
Administer payments to near shore employees in Brazil.

## Pain Points
- Delay in payment processing due to the five-day clearance period. (impact: medium, frequency: sometimes)

## Candidate Modules
- **Invoice Management** (must-have) - Module to track and manage invoices sent to clients.
- **Payment Processing** (must-have) - Module to automate the payment process to employees.

## Non Functional Needs
- System reliability
- Data security

## Open Questions
- What tools or systems do you currently use to track invoices sent to Omnigo?
- How do you ensure that payments are made on time to employees?
``` mermaid
flowchart TD
  Consulting_Company["Consulting Company"]
  Employees["Employees"]
  Omnigo["Omnigo"]
  Invoice_Management["Invoice Management"]
  Payment_Processing["Payment Processing"]
  Consulting_Company --> Invoice_Management
  Consulting_Company --> Payment_Processing
  Employees --> Invoice_Management
  Employees --> Payment_Processing
  Omnigo --> Invoice_Management
  Omnigo --> Payment_Processing