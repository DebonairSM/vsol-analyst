```mermaid
flowchart TD
  client_omnigo["Client (Omnigo)"]
  consultants["Consultants"]
  owner["Owner"]
  wife_of_owner["Wife of Owner"]
  automated_reminders["Automated Reminders"]
  client_portal_for_invoice_viewing["Client Portal for Invoice Viewing"]
  currency_management["Currency Management"]
  document_management["Document Management"]
  feedback_mechanism["Feedback Mechanism"]
  integration_with_time_tracking_tools["Integration with Time Tracking Tools"]
  invoice_submission_portal["Invoice Submission Portal"]
  reporting_and_analytics["Reporting and Analytics"]
  status_tracking["Status Tracking"]
  workflow_visualization_dashboard["Workflow Visualization Dashboard"]
  time_doctor["Time Doctor"]
  client_omnigo --> client_portal_for_invoice_viewing
  consultants --> automated_reminders
  consultants --> currency_management
  consultants --> feedback_mechanism
  consultants --> invoice_submission_portal
  consultants --> status_tracking
  owner --> currency_management
  owner --> document_management
  owner --> feedback_mechanism
  owner --> reporting_and_analytics
  owner --> status_tracking
  owner --> workflow_visualization_dashboard
  wife_of_owner --> currency_management
  wife_of_owner --> document_management
  wife_of_owner --> feedback_mechanism
  wife_of_owner --> reporting_and_analytics
  wife_of_owner --> status_tracking
  wife_of_owner --> workflow_visualization_dashboard
  time_doctor --> integration_with_time_tracking_tools   %% integration
```