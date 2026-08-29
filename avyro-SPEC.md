# Avyro
## Product, UX & Engineering Specification

**Status:** Implementation specification  
**Initial deployment:** Miriyam Core  
**Initial market:** Bangladesh  
**Initial business type:** Sole proprietorship / software business  
**Future direction:** Multi-tenant SaaS  
**Base currency:** BDT  
**Working product name:** `Avyro`

---

# 1. Executive Summary

`Avyro` is an accounting-first business operating system.

Its first real-world deployment will be for **Miriyam Core**, a Bangladesh-based software business. The system should manage the complete business-finance trail from customer and contract through invoice, payment, banking, expense, accounting, compliance records, and reports.

The application must be built with two goals that are equally important:

1. **It must be extremely easy to use.**
2. **Its accounting data must be structurally correct.**

A business owner should not need accounting knowledge to operate it.

The interface should say:

- Create invoice
- Record expense
- Add payment
- Match bank transaction
- Pay supplier
- Upload receipt
- Close month

It should **not** force normal users to think in:

- Debit
- Credit
- Journal codes
- Account numbers
- Posting batches
- General-ledger terminology

Those concepts still exist underneath, because the accounting engine is a proper double-entry ledger.

The system should have:

- **Simple Mode** — default for owners/managers.
- **Accountant Mode** — optional advanced interface exposing journals, ledgers, account codes, adjustments, trial balance, period controls, and accounting detail.

The first version is an internal application for Miriyam Core, but the database and domain model must be SaaS-ready from day one. No core accounting logic may be hard-coded specifically to Miriyam Core.

---

# 2. Product Principles

These principles are requirements.

## 2.1 Accounting should happen automatically

Operational actions create accounting entries.

Example:

> User creates and issues an invoice.

The system automatically posts:

- Accounts Receivable
- Revenue
- Applicable tax components

The user should not manually create that journal.

---

## 2.2 One obvious primary action per screen

Do not produce ERP-style interfaces containing twenty competing buttons.

Examples:

### Invoices page

Primary action:

> New Invoice

Secondary actions may exist in menus.

### Expenses page

Primary action:

> Add Expense

### Banking page

Primary action:

> Reconcile

---

## 2.3 Plain language first

Prefer:

> Money customers owe you

over:

> Trade Debtors

Prefer:

> Money you owe suppliers

over:

> Trade Creditors

Accountants may optionally enable conventional terminology.

---

## 2.4 Progressive disclosure

Keep advanced controls hidden until needed.

A normal expense form should initially show:

- Supplier
- Date
- Amount
- Category
- Paid from
- Receipt
- Notes

Advanced options can reveal:

- Tax treatment
- VAT
- Withholding
- Project
- Cost centre
- Currency
- Exchange rate
- Accounting override

---

## 2.5 Never ask twice

Remember useful defaults.

Examples:

- Last selected bank account.
- Default invoice payment terms.
- Default currency for a customer.
- Default revenue category.
- Default tax treatment for an overseas customer.
- Default expense category for a recurring supplier.

---

## 2.6 Search before navigation

The application needs global search.

Users should be able to search:

`MC-2026-001`

and immediately find the invoice.

Or:

`Inoryum`

and see:

- Customer
- Contracts
- Invoices
- Payments
- Related projects
- Documents

---

## 2.7 Every number should be explainable

Clicking a dashboard number such as:

> Revenue ৳842,400

must show the transactions that created it.

No unexplained summary values.

---

## 2.8 Never silently change accounting history

Once an accounting period is locked, transactions in the period cannot simply be edited.

Corrections happen using:

- Reversal
- Credit note
- Adjustment
- Reopening period by an authorised role

Every change is audited.

---

# 3. Product Scope

## Initial V1

V1 should include:

- Organisation setup
- Dashboard
- Chart of accounts
- Double-entry ledger
- Customers
- Contracts
- Projects — lightweight
- Quotes/estimates
- Invoices
- Credit notes
- Payments
- Payment methods
- Payment gateways architecture
- Expenses
- Suppliers
- Supplier bills
- Bank accounts
- Bank transaction import
- Bank reconciliation
- Multi-currency
- Owner capital/drawings
- Attachments/documents
- Tax configuration framework
- VAT configuration framework
- Withholding configuration framework
- Export/service-income evidence records
- Basic assets register
- Financial reports
- Audit logs
- Period locking
- User roles
- Notifications/reminders
- Settings
- Backups/export

## Later

Later versions may add:

- Full payroll
- Employee leave
- Attendance
- Advanced time tracking
- Purchase orders
- Advanced budgeting
- Recurring expenses
- Advanced fixed-asset depreciation
- Automated bank feeds
- AI-assisted categorisation
- OCR receipt parsing
- Accountant portal
- SaaS billing
- Public API
- Webhooks
- Multi-organisation switching
- White-labeling
- Mobile applications

## Explicitly out of scope initially

Do not build these unless a real business requirement appears:

- Inventory
- Warehousing
- Manufacturing
- POS
- Retail barcode flows
- Logistics
- Advanced CRM
- Marketing automation

Miriyam Core is primarily a software/service business.

---

# 4. UX Architecture

## 4.1 Main navigation

Use a compact left sidebar.

```text
Avyro

Overview

Sales
  Customers
  Quotes
  Invoices
  Payments
  Contracts

Expenses
  Expenses
  Suppliers
  Bills

Banking

Projects

Accounting
  Transactions
  Chart of Accounts
  Journals
  Reconciliation
  Periods

Compliance
  Tax
  VAT
  Withholding
  Export Records
  Business Documents

Reports

Documents

Settings
```

In **Simple Mode**, the Accounting submenu may be collapsed or visually de-emphasised.

---

# 5. Overview Dashboard

The dashboard must answer:

> How is the business doing and what needs my attention?

Suggested layout:

```text
Good evening, Salehin.

August 2026

Revenue                  Expenses
৳ 842,400                ৳ 192,700

Operating Profit         Cash
৳ 649,700                ৳ 418,200


Money owed to us         Money we owe
৳ 320,000                ৳ 41,500
```

Then:

```text
Needs attention

2 overdue invoices
3 bank transactions need matching
5 expenses are missing receipts
1 contract expires soon
Trade licence renewal due in ...
```

Then:

```text
Cash flow
[chart]
```

Then:

```text
Recent activity
```

Avoid displaying accounting ratios a normal owner does not need.

---

# 6. Quick Create

Provide a global `+` button.

Options:

```text
Invoice
Expense
Customer
Supplier
Payment
Bill
Contract
Project
Transfer
Owner Contribution
Owner Withdrawal
```

Keyboard shortcut:

```text
C
```

or command palette:

```text
⌘K / Ctrl+K
```

Command examples:

```text
Create invoice
Record expense
Find Inoryum
Open bank reconciliation
Show unpaid invoices
```

---

# 7. Organisation Model

Although the first installation only uses Miriyam Core, all business data must belong to an organisation.

```text
organizations

id
name
legal_name
legal_type
business_activity
country_code
base_currency
timezone
fiscal_year_start
address
phone
email
website
logo_url
tax_identifier
vat_identifier
trade_license_number
status
created_at
updated_at
```

Initial organisation:

```text
Name:
Miriyam Core

Legal Type:
Sole Proprietorship

Business Activity:
Software Nirmata Protishthan

Country:
Bangladesh

Base Currency:
BDT

Timezone:
Asia/Dhaka
```

Future SaaS tenancy must not require changing accounting tables.

---

# 8. Tenant Architecture

Every tenant-owned business table must include:

```text
organization_id
```

Never query tenant data without organisation scoping.

Recommended hierarchy for future SaaS:

```text
User
  ↓
Workspace
  ↓
Organisation
  ↓
Business Data
```

V1 may internally create:

```text
Workspace: Miriyam Workspace
Organisation: Miriyam Core
```

but workspace switching should remain hidden.

---

# 9. Users & Permissions

Suggested roles:

## Owner

Full access.

## Accountant

Can access:

- Accounting
- Bank reconciliation
- Compliance
- Reports
- Period closing
- Journal adjustments

## Manager

Can access:

- Customers
- Projects
- Contracts
- Invoices
- Expenses

Cannot:

- Change accounting configuration
- Reopen periods
- Delete posted records

## Employee

Can:

- Submit expenses
- Upload receipts
- Enter time
- View assigned projects

## Auditor

Read-only access to:

- Accounting
- Documents
- Reports
- Audit history

Implement RBAC at the API/service layer, not only UI.

---

# 10. Accounting Engine

This is the core of Avyro.

Use proper double-entry bookkeeping.

The accounting engine must guarantee:

```text
Total debits = Total credits
```

for every posted journal entry.

Never allow a posted journal to become unbalanced.

---

# 11. Chart of Accounts

Provide a Bangladesh/software-business-friendly default chart, but make it editable.

Example:

```text
1000 Assets

1100 Cash & Bank
  1101 Cash
  1110 EBL Business BDT
  1120 Payment Gateway Clearing
  1130 Foreign Currency Account

1200 Accounts Receivable
1300 Prepayments
1400 Deposits

1500 Fixed Assets
  1510 Computers
  1520 Office Equipment
  1530 Furniture

1600 Accumulated Depreciation


2000 Liabilities

2100 Accounts Payable
2200 Tax Payable
2210 VAT Payable
2220 Withholding Tax Payable
2300 Payroll Payable
2400 Accrued Expenses


3000 Owner's Equity

3100 Owner Capital
3200 Owner Drawings
3300 Retained Earnings / Current Earnings


4000 Revenue

4100 Software Development
4200 Software Consultancy
4300 SaaS Revenue
4400 Maintenance & Support
4500 Domestic Service Revenue
4600 Export Service Revenue
4700 Other Revenue


5000 Direct Costs

5100 Subcontractors
5200 Client Infrastructure
5300 Project Software
5400 Payment Processing Fees


6000 Operating Expenses

6100 Salaries
6200 Office Rent
6300 Electricity
6400 Internet
6500 Telephone
6600 Hosting & Servers
6700 Software Subscriptions
6800 Domains
6900 Accounting & Legal
6910 Banking Fees
6920 Marketing
6930 Equipment
6940 Travel
6950 Miscellaneous
```

Account numbers are visible in Accountant Mode only by default.

---

# 12. Journal Model

Core entities:

```text
journal_entries

id
organization_id
journal_number
entry_date
description
source_type
source_id
status
currency
exchange_rate
created_by
posted_by
posted_at
reversed_entry_id
created_at
updated_at
```

```text
journal_lines

id
organization_id
journal_entry_id
account_id
description
debit_amount
credit_amount
base_debit_amount
base_credit_amount
currency
exchange_rate
customer_id
supplier_id
project_id
tax_code_id
created_at
```

Journal statuses:

```text
DRAFT
POSTED
REVERSED
```

Posted entries cannot be edited in place.

---

# 13. Accounting Posting Service

Individual modules must not directly write arbitrary journal rows.

Use one central service:

```text
AccountingPostingService
```

Domain services call posting methods.

Examples:

```text
postInvoice(invoice)
postInvoicePayment(payment)
postExpense(expense)
postSupplierBill(bill)
postBillPayment(payment)
postGatewaySettlement(settlement)
postBankTransfer(transfer)
postOwnerContribution(transaction)
postOwnerWithdrawal(transaction)
postCreditNote(creditNote)
postAssetPurchase(asset)
postTaxPayment(payment)
```

The posting service should be covered by strong unit tests.

---

# 14. Posting Rules

## Customer invoice

```text
Accounts Receivable       DR
    Revenue                    CR
    Tax/VAT payable            CR   when applicable
```

## Customer payment

```text
Bank / Gateway Clearing   DR
    Accounts Receivable        CR
```

## Gateway settlement

Example customer pays 100,000 and gateway deducts 3,500:

```text
Bank                       DR 96,500
Gateway Fee Expense        DR  3,500
    Gateway Clearing          CR 100,000
```

## Immediate expense paid from bank

```text
Expense                    DR
    Bank                      CR
```

## Supplier bill

```text
Expense / Asset            DR
    Accounts Payable          CR
```

## Supplier bill payment

```text
Accounts Payable           DR
    Bank                      CR
```

## Owner contribution

```text
Bank                       DR
    Owner Capital             CR
```

## Owner withdrawal

```text
Owner Drawings             DR
    Bank                      CR
```

Owner withdrawals must never be categorised as operating expenses.

---

# 15. Transaction Immutability

A posted transaction must never be hard-deleted.

Corrections:

```text
Original Entry
    ↓
Reversal Entry
    +
Replacement/Correcting Entry
```

Documents may be voided/cancelled depending on document type, but accounting history remains traceable.

---

# 16. Accounting Periods

Entity:

```text
accounting_periods

id
organization_id
start_date
end_date
status
closed_at
closed_by
```

Statuses:

```text
OPEN
SOFT_CLOSED
LOCKED
```

When locked:

- No normal transactions may be backdated into the period.
- Accountant/Owner may reopen with audit reason.
- Reopening must be logged.

---

# 17. Customers

Customer entity:

```text
customers

id
organization_id
customer_number
name
legal_name
type
country_code
address
email
phone
website
tax_identifier
vat_identifier
default_currency
default_payment_terms
default_revenue_account_id
default_tax_code_id
is_related_party
status
notes
created_at
updated_at
```

Types:

```text
BUSINESS
INDIVIDUAL
GOVERNMENT
OTHER
```

Additional customer flags:

```text
domestic
foreign
related_party
```

Initial foreign customer example:

```text
Inoryum Ltd
Country: United Kingdom
Currency: GBP
Related party: Yes
```

---

# 18. Customer 360 View

A customer page should provide tabs:

```text
Overview
Invoices
Payments
Contracts
Projects
Documents
Activity
```

Overview:

```text
Total invoiced
Total received
Outstanding
Overdue
Average payment time
Active contracts
```

Keep it understandable.

---

# 19. Contracts

Contracts are structured records, not merely uploaded PDFs.

```text
contracts

id
organization_id
customer_id
contract_number
title
description
effective_date
expiry_date
billing_type
currency
contract_value
payment_terms
service_type
is_related_party
status
document_id
created_at
updated_at
```

Billing types:

```text
FIXED
MILESTONE
MONTHLY
RETAINER
HOURLY
OTHER
```

Statuses:

```text
DRAFT
ACTIVE
EXPIRED
TERMINATED
COMPLETED
```

Contracts may generate invoice reminders or recurring invoice drafts later.

---

# 20. Projects

Keep project management deliberately lightweight.

```text
projects

id
organization_id
customer_id
contract_id
project_code
name
description
status
start_date
end_date
currency
budget_amount
project_manager_id
created_at
updated_at
```

Status:

```text
PLANNED
ACTIVE
ON_HOLD
COMPLETED
CANCELLED
```

Link:

- Revenue
- Expenses
- Bills
- Time
- Documents
- Invoices

Project dashboard:

```text
Revenue
Direct cost
Gross margin
Outstanding invoices
Hours
```

---

# 21. Quotes / Estimates

Allow creation of quotes.

Flow:

```text
Draft Quote
    ↓
Send
    ↓
Accepted
    ↓
Convert to Invoice
```

Entity:

```text
quotes
quote_items
```

Statuses:

```text
DRAFT
SENT
VIEWED
ACCEPTED
REJECTED
EXPIRED
CONVERTED
```

Conversion should preserve the original quote.

---

# 22. Invoices

Invoice creation must be extremely fast.

## Basic invoice form

```text
Customer
Invoice date
Due date
Currency

Items:
Description
Quantity
Rate

Notes
```

Advanced section:

```text
Contract
Project
Tax treatment
Exchange rate
Payment terms
Purchase order reference
Custom fields
```

Entity:

```text
invoices

id
organization_id
customer_id
contract_id
project_id
invoice_number
issue_date
due_date
currency
exchange_rate
status
subtotal
discount_total
tax_total
grand_total
amount_paid
amount_due
notes
terms
external_reference
issued_at
paid_at
created_by
created_at
updated_at
```

```text
invoice_items

id
invoice_id
description
quantity
unit_price
discount
revenue_account_id
tax_code_id
line_total
sort_order
```

Statuses:

```text
DRAFT
ISSUED
SENT
VIEWED
PARTIALLY_PAID
PAID
OVERDUE
VOID
CREDITED
```

---

# 23. Invoice Numbering

Configurable numbering.

Initial default:

```text
MC-2026-0001
MC-2026-0002
```

Future SaaS:

```text
{PREFIX}-{YEAR}-{SEQUENCE}
```

Sequence generation must be concurrency-safe.

Never reuse issued invoice numbers.

---

# 24. Invoice PDF

Generate clean professional PDFs.

Include:

- Logo
- Legal business name
- Address
- Trade licence/TIN/BIN fields if configured
- Customer details
- Invoice number
- Dates
- Line items
- Currency
- Payment instructions
- Notes
- Tax details where applicable

Templates should be separate from accounting logic.

---

# 25. Invoice Payment Page

Support a hosted page:

```text
/pay/{secure_token}
```

It can show:

```text
Miriyam Core
Invoice MC-2026-0001

Amount due
£2,500

[Pay securely]
```

Payment methods depend on integrations.

Do not expose internal invoice database IDs.

Use secure random payment tokens.

---

# 26. Credit Notes

Never edit a paid/issued historical invoice simply to reduce revenue.

Use credit notes.

```text
credit_notes
credit_note_items
```

Support:

- Full credit
- Partial credit
- Apply against invoice
- Refund later

Automatic accounting posting.

---

# 27. Payments

Entity:

```text
payments

id
organization_id
customer_id
invoice_id
payment_number
payment_date
amount
currency
exchange_rate
method
destination_account_id
gateway_id
gateway_transaction_id
reference
status
created_at
updated_at
```

Methods:

```text
BANK_TRANSFER
CARD
PAYMENT_GATEWAY
CASH
CHEQUE
OTHER
```

Support one payment across multiple invoices later.

Support partial payment from V1.

---

# 28. Payment Gateway Architecture

Use provider adapters.

Interface concept:

```ts
interface PaymentGatewayProvider {
  createCheckout(input): Promise<CheckoutResult>;
  getPayment(id): Promise<PaymentResult>;
  verifyWebhook(input): Promise<VerifiedEvent>;
  refundPayment(input): Promise<RefundResult>;
  getSettlement?(id): Promise<SettlementResult>;
}
```

Adapters may later include:

```text
PortWallet
SSLCOMMERZ
aamarPay
EBL/other gateway
Stripe if future markets need it
Manual payment
```

Never make business logic dependent on one gateway.

---

# 29. Gateway Clearing

Payment gateways must use clearing accounts.

Entities:

```text
payment_gateway_accounts
gateway_transactions
gateway_settlements
gateway_settlement_items
```

Settlement reconciliation should connect:

```text
Customer Payment
    ↓
Gateway Transaction
    ↓
Gateway Settlement
    ↓
Bank Transaction
    ↓
Journal Entries
```

---

# 30. Expenses

Expense entry should take less than a minute.

Basic form:

```text
Supplier / Payee
Date
Amount
Category
Paid from
Receipt
Description
```

Optional:

```text
Project
Currency
VAT
Withholding
Reference
Tags
```

Entity:

```text
expenses

id
organization_id
supplier_id
expense_date
description
category_account_id
amount
currency
exchange_rate
base_amount
payment_account_id
project_id
tax_code_id
receipt_document_id
status
created_by
created_at
updated_at
```

Expense statuses:

```text
DRAFT
RECORDED
VOID
```

---

# 31. Receipt-first Expense Entry

Provide a shortcut:

```text
Upload Receipt
```

Then show an expense form with attachment already present.

OCR/AI extraction is future functionality, but the UX should be designed so it can be added later.

---

# 32. Suppliers

Entity:

```text
suppliers

id
organization_id
supplier_number
name
legal_name
country_code
address
email
phone
tax_identifier
vat_identifier
default_currency
default_expense_account_id
payment_terms
status
created_at
updated_at
```

Supplier page:

```text
Overview
Bills
Payments
Expenses
Documents
Activity
```

---

# 33. Supplier Bills / Accounts Payable

Entity:

```text
supplier_bills
supplier_bill_items
```

Statuses:

```text
DRAFT
OPEN
PARTIALLY_PAID
PAID
OVERDUE
VOID
```

Bill fields:

```text
Supplier
Supplier invoice/reference
Bill date
Due date
Currency
Items
Expense/asset category
Tax treatment
Attachment
```

---

# 34. Bank Accounts

Entity:

```text
bank_accounts

id
organization_id
name
bank_name
account_holder
account_number_masked
account_type
currency
ledger_account_id
opening_balance
opening_balance_date
active
created_at
updated_at
```

Initial examples may include:

```text
EBL Business BDT
Cash
PortWallet Clearing
```

Sensitive bank details should be encrypted where appropriate.

---

# 35. Bank Transactions

Entity:

```text
bank_transactions

id
organization_id
bank_account_id
transaction_date
value_date
description
reference
amount
currency
balance_after
direction
import_batch_id
external_hash
reconciliation_status
created_at
```

Directions:

```text
INFLOW
OUTFLOW
```

Statuses:

```text
UNMATCHED
SUGGESTED
MATCHED
EXCLUDED
```

---

# 36. Bank Statement Imports

V1 should support:

```text
CSV
XLSX
```

Do not make PDF extraction a dependency for V1.

Import workflow:

```text
Upload statement
    ↓
Choose column mapping
    ↓
Preview
    ↓
Import
    ↓
Detect duplicates
    ↓
Reconcile
```

Save mappings by bank/account.

---

# 37. Bank Reconciliation

Reconciliation UI is one of the most important screens.

Use a split view:

```text
BANK TRANSACTION                 Avyro

+ ৳320,000                      Invoice MC-2026-001
INORYUM LTD                     ৳320,000

[Match]
```

Possible actions:

```text
Match
Create Expense
Create Income
Record Transfer
Record Owner Contribution
Record Owner Withdrawal
Split
Exclude
```

The user should not need to create journals manually.

---

# 38. Reconciliation Suggestions

Use deterministic suggestions initially.

Match based on:

- Amount
- Date proximity
- Invoice/reference
- Customer/supplier name
- Gateway settlement ID

Show confidence:

```text
Strong match
Possible match
```

Do not auto-post ambiguous matches.

---

# 39. Transfers

Transfers between business accounts should not be income or expense.

Workflow:

```text
From account
To account
Amount
Date
Fee if any
Reference
```

Accounting:

```text
Destination Bank   DR
    Source Bank        CR
```

Fees separately posted as expense.

---

# 40. Owner Transactions

Because the initial company is a sole proprietorship, owner transactions need excellent UX.

Quick actions:

```text
Put personal money into business
Take money out for personal use
Business expense paid personally
Personal expense accidentally paid by business
```

Do not make users infer the accounting treatment.

Mapped accounting:

```text
Owner Contribution
Owner Drawings
Owner Reimbursement / Due to Owner
```

---

# 41. Multi-Currency

Store both original and base amounts.

For monetary transaction records:

```text
currency
foreign_amount
exchange_rate
base_amount
exchange_rate_source
exchange_rate_date
```

The base ledger currency for Miriyam Core is BDT.

Never discard the original currency.

Example:

```text
Invoice:
GBP 2,500

Book value:
BDT xxx,xxx

Currency:
GBP

Exchange rate:
stored with transaction
```

---

# 42. Exchange Rates

V1 options:

```text
Manual
Configured daily rate
Imported rate provider later
```

Allow accountant override with reason.

Never rewrite old transactions when today's exchange rate changes.

---

# 43. Foreign Exchange Gains/Losses

If an invoice is booked at one rate and paid at another, calculate realised FX difference.

Example structure:

```text
Accounts Receivable
Bank
FX Gain
FX Loss
```

Implement this only after core multi-currency tests are correct.

---

# 44. Bangladesh Compliance Architecture

Important rule:

**Do not hard-code current tax, VAT, withholding, export, or reporting rules into transaction code.**

Bangladesh rules can change.

Use effective-dated configuration.

The product should support compliance workflows, document storage, calculations, and reporting assistance, but Avyro should not claim that software configuration itself is legal/tax advice.

Final configuration should be reviewed by a qualified Bangladesh accountant/tax professional before production filing.

---

# 45. Compliance Settings

Entity:

```text
compliance_profiles

id
organization_id
country_code
tax_identifier
vat_identifier
tax_status
vat_status
trade_license_number
trade_license_authority
trade_license_issue_date
trade_license_expiry_date
notes
```

---

# 46. Tax Rule Configuration

Entity concept:

```text
tax_rules

id
country_code
rule_type
code
name
description
rate
calculation_method
effective_from
effective_to
metadata_json
active
```

Rule types may include:

```text
VAT
WITHHOLDING
INCOME_TAX_REFERENCE
TURNOVER
OTHER
```

Never overwrite historic rule rates.

Create new effective-dated records.

---

# 47. Tax Codes

Transaction-facing codes:

```text
tax_codes

id
organization_id
code
name
description
tax_rule_id
sales_or_purchase
ledger_account_id
active
```

Examples should be configured by accountant.

Possible semantic categories:

```text
Standard
Zero-rated
Exempt
Outside scope
Not configured
```

Do not assume which one legally applies to a given transaction.

---

# 48. VAT / BIN Module

Provide a compliance centre capable of storing:

```text
BIN
Registration status
Registration date
VAT office/circle
Reporting periods
VAT documents
Returns
Payments
Supporting files
```

The software should be able to derive reports from transaction data.

Do not directly submit to government systems in V1.

---

# 49. VAT Documents / Mushak Support

Build a generic document model:

```text
vat_documents

id
organization_id
document_type
document_number
period_id
transaction_type
transaction_id
issue_date
taxable_amount
vat_amount
document_id
status
```

Do not couple the ledger to one exact government form layout.

Renderers/exporters can evolve independently.

---

# 50. Withholding Module

Entity:

```text
withholdings

id
organization_id
direction
party_type
party_id
source_transaction_type
source_transaction_id
gross_amount
rate
withheld_amount
currency
certificate_number
certificate_date
tax_period_id
document_id
status
```

Directions:

```text
WITHHELD_FROM_US
WITHHELD_BY_US
```

Support uploaded certificates/evidence.

Rates must come from effective-dated configuration.

---

# 51. Export / Foreign Service Income

Because Miriyam Core provides software services to overseas clients, create a dedicated evidence layer.

Entity:

```text
service_export_records

id
organization_id
customer_id
contract_id
invoice_id
payment_id
country_code
service_category
invoice_currency
invoice_amount
base_amount
payment_method
gateway_transaction_id
bank_transaction_id
remittance_reference
declaration_reference
status
notes
created_at
updated_at
```

Document checklist:

```text
Contract
Invoice
Payment evidence
Gateway record
Settlement statement
Bank statement
Relevant bank/remittance document
Other declaration/certificate
```

Do not force a particular document if it does not apply.

Use configurable checklist templates.

---

# 52. Evidence Chain View

This should be a standout feature.

For an overseas invoice:

```text
MC-2026-0001
Inoryum Ltd
GBP 2,500

Contract                    ✓
Invoice                     ✓
Payment                     ✓
Gateway transaction         ✓
Settlement                  ✓
Bank transaction            ✓
Accounting entry            ✓
Supporting documents        ✓
```

If anything is missing:

```text
Bank settlement             Missing
```

This is much more useful than a generic attachment folder.

---

# 53. Trade Licence & Business Documents

Compliance document records:

```text
business_documents

id
organization_id
type
number
issued_by
issue_date
expiry_date
document_id
status
reminder_days
notes
```

Types may include:

```text
TRADE_LICENSE
TIN
BIN
BANK_DOCUMENT
CERTIFICATE
CONTRACT_TEMPLATE
OTHER
```

Provide expiry reminders.

---

# 54. Document Vault

Use object storage.

Recommended:

```text
Cloudflare R2
```

Database stores metadata only.

```text
documents

id
organization_id
storage_key
original_filename
mime_type
file_size
checksum
category
uploaded_by
created_at
```

Relationships should use document links:

```text
document_links

id
organization_id
document_id
entity_type
entity_id
label
```

One document may be related to multiple records.

---

# 55. File Security

Requirements:

- Private bucket by default.
- Signed download URLs.
- Organisation authorization check before URL generation.
- File size limits.
- MIME validation.
- Malware scanning hook for future SaaS.
- Checksums.
- Audit downloads for sensitive compliance documents if needed.

---

# 56. Assets Register

V1 basic fields:

```text
assets

id
organization_id
asset_number
name
category
purchase_date
purchase_cost
currency
supplier_id
serial_number
warranty_expiry
assigned_user_id
status
document_id
notes
```

Statuses:

```text
ACTIVE
DISPOSED
LOST
UNDER_REPAIR
```

Depreciation engine can be a later milestone.

---

# 57. People / Employees

V1 may keep this lightweight.

```text
people

id
organization_id
employee_number
name
email
phone
designation
department
join_date
leave_date
employment_status
tax_identifier
bank_details_encrypted
```

Payroll can come after accounting V1.

---

# 58. Payroll Future Architecture

When implemented:

```text
payroll_periods
payroll_runs
payroll_items
payslips
employee_compensation
```

A payroll run should post one controlled accounting batch.

Do not create a full HR platform before payroll is genuinely needed.

---

# 59. Time Tracking

Optional lightweight module.

```text
time_entries

id
organization_id
project_id
user_id
entry_date
hours
description
billable
billing_rate
```

Useful for project profitability even when client billing is fixed-price.

---

# 60. Reporting

Financial reports:

```text
Profit & Loss
Balance Sheet
Cash Flow Statement
Trial Balance
General Ledger
Journal Report
Accounts Receivable Aging
Accounts Payable Aging
Bank Reconciliation
Tax Summary
VAT Summary
Withholding Summary
Owner Equity
Export Service Revenue
```

Management reports:

```text
Revenue by customer
Revenue by country
Revenue by project
Expenses by category
Project profitability
Monthly recurring revenue where applicable
Cash movement
Payment gateway fees
```

---

# 61. Report Drill-Down

Every report amount must be clickable.

Example:

```text
Hosting & Servers      ৳72,000
```

Click:

```text
AWS                  ৳22,000
DigitalOcean         ৳31,000
Cloudflare           ৳19,000
```

Click again to reach the transaction and receipt.

---

# 62. Reports Export

Support:

```text
PDF
CSV
XLSX
```

Financial data exports must include:

```text
Report period
Generated at
Organisation
Base currency
Filters
```

---

# 63. Related Party Reporting

Support related-party flag for:

- Customer
- Supplier
- Contract

Create report:

```text
Related Party Transactions
```

For Miriyam Core this can clearly report business with Inoryum Ltd.

View:

```text
Inoryum Ltd

Contracted
Invoiced
Paid
Outstanding
Processing fees
Revenue recognised
Documents complete
```

---

# 64. Notifications

Notification centre.

Examples:

```text
Invoice overdue
Invoice paid
Bank reconciliation required
Receipt missing
Contract nearing expiry
Trade licence nearing expiry
Tax/VAT period approaching
Supplier bill due
Accounting period ready to close
```

Channels initially:

```text
In-app
Email
```

Later:

```text
Push
WhatsApp/integrations if appropriate
```

---

# 65. Activity Feed

Every major business record should show chronological activity.

Example invoice:

```text
Aug 01 — Draft created by Salehin
Aug 01 — Invoice issued
Aug 01 — Email sent
Aug 04 — Payment received
Aug 05 — Gateway settlement received
Aug 05 — Bank transaction matched
```

---

# 66. Audit Logging

Entity:

```text
audit_logs

id
organization_id
user_id
action
entity_type
entity_id
before_json
after_json
ip_address
user_agent
created_at
```

Log:

- Create
- Edit
- Delete/void
- Post
- Reverse
- Reconcile
- Reopen period
- Change compliance rule
- Change bank settings
- Role/permission changes

Audit log is append-only.

---

# 67. Search

Global indexed search should cover:

```text
Customers
Suppliers
Invoices
Quotes
Contracts
Projects
Payments
Expenses
Bills
Bank transactions
Documents
Journal numbers
References
```

Search result format:

```text
Invoice
MC-2026-0001
Inoryum Ltd · GBP 2,500 · Paid
```

---

# 68. Filters

Reusable filters:

```text
Date range
Status
Customer
Supplier
Project
Currency
Amount
Category
Payment method
Country
Missing document
```

Do not require separate "advanced search" pages for common queries.

---

# 69. UI Component Philosophy

Use reusable primitives:

```text
PageHeader
MetricCard
DataTable
FilterBar
SearchInput
StatusBadge
Money
CurrencyInput
DateInput
EntitySelect
DocumentUploader
EmptyState
Timeline
ActivityFeed
SidePanel
ConfirmationDialog
CommandPalette
```

Forms should use drawers/modals only for genuinely short flows.

Complex records deserve dedicated pages.

---

# 70. Empty States

Never show a dead blank table.

Example customers:

```text
No customers yet.

Add the companies or people you invoice.

[Add first customer]
```

Example banking:

```text
No bank account connected yet.

Add your business account to start reconciling payments and expenses.

[Add bank account]
```

---

# 71. Setup Wizard

First-run wizard should be short.

## Step 1 — Business

```text
Business name
Country
Base currency
Business type
Financial year
```

## Step 2 — Business identifiers

Optional/skippable:

```text
Trade licence
TIN
BIN
```

## Step 3 — Banking

```text
Add bank account
or Skip
```

## Step 4 — Invoice

```text
Logo
Invoice prefix
Payment terms
```

Then:

> Avyro is ready.

Do not ask twenty accounting questions during onboarding.

Advanced accounting defaults may be pre-seeded.

---

# 72. Simple Mode vs Accountant Mode

## Simple Mode

Default.

Hide:

- Account numbers
- Raw journal builder
- Posting controls
- Ledger internals

Show:

- Business actions
- Plain language
- Automatic accounting

## Accountant Mode

Show:

- Chart codes
- Journals
- Posting details
- Trial balance
- Manual adjustments
- Period management
- Reconciliation details
- Tax code mappings

Mode preference is per user.

Permissions still apply.

---

# 73. Technical Stack

Recommended stack:

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
TanStack Table
TanStack Query where useful
Recharts for business charts
```

## Backend

Recommended:

```text
NestJS
TypeScript
```

Why separate backend:

- Accounting is domain-heavy.
- Background jobs will grow.
- Payment webhooks need clear boundaries.
- Future SaaS/API becomes easier.
- Keeps accounting logic out of UI/server components.

## Database

```text
PostgreSQL
```

## ORM

```text
Prisma
```

## Queue

```text
Redis
BullMQ
```

## Object storage

```text
Cloudflare R2 / S3-compatible
```

## Authentication

Use a well-supported authentication solution such as:

```text
Better Auth
```

or another maintained provider.

Authentication must not be custom-built cryptography.

---

# 74. Repository Layout

Recommended monorepo:

```text
avyro/

apps/
  web/
  api/

packages/
  database/
  accounting/
  ui/
  validation/
  config/
  types/
  testing/

infra/
  docker/
  nginx/
  scripts/

docs/
  architecture/
  accounting/
  compliance/
  api/
```

Use:

```text
pnpm workspaces
```

or Turborepo if useful.

Do not add orchestration complexity solely for fashion.

---

# 75. Backend Module Layout

```text
src/modules/

auth/
organizations/
users/
permissions/

accounting/
chart-of-accounts/
journals/
periods/

customers/
suppliers/
contracts/
projects/

quotes/
invoices/
credit-notes/
payments/

expenses/
bills/

banking/
reconciliation/

payment-gateways/

tax/
vat/
withholding/
compliance/
service-exports/

documents/
assets/
people/

reports/
notifications/
audit/
```

Each module owns its business rules.

---

# 76. Domain Events

Use domain events for cross-module workflows.

Examples:

```text
invoice.issued
invoice.overdue
payment.received
payment.allocated
gateway.settlement.received
expense.recorded
bill.posted
bill.paid
bank.transaction.imported
bank.transaction.reconciled
period.closed
document.expiring
```

Do not use an event bus to avoid normal function calls inside one transaction.

Use events where decoupling is actually useful.

---

# 77. Database Transaction Boundaries

Accounting operations must be atomic.

Example:

When issuing an invoice:

```text
1. Validate invoice
2. Lock sequence / assign invoice number
3. Mark invoice issued
4. Create journal
5. Create journal lines
6. Commit
```

If journal posting fails, invoice issuance must roll back.

Never allow:

```text
Invoice = Issued
Journal = Missing
```

---

# 78. Idempotency

Critical for:

- Payment webhooks
- Bank imports
- Gateway settlements
- Invoice issuance requests
- Background jobs

Store provider event IDs / idempotency keys.

Receiving the same gateway webhook five times must create only one payment.

---

# 79. Money Representation

Never use JavaScript floating point for stored money calculations.

Use:

```text
Decimal
```

Database:

```text
NUMERIC/DECIMAL
```

Define consistent precision.

Currency-aware formatting is UI responsibility.

---

# 80. Dates & Time

Store timestamps in UTC.

Store organisation timezone:

```text
Asia/Dhaka
```

Accounting dates are local business dates and should be modelled explicitly rather than inferred from UTC timestamps.

---

# 81. API Design

Use REST initially.

Example routes:

```text
/api/v1/organizations

/api/v1/customers
/api/v1/customers/:id

/api/v1/contracts
/api/v1/projects

/api/v1/quotes

/api/v1/invoices
/api/v1/invoices/:id
/api/v1/invoices/:id/issue
/api/v1/invoices/:id/send
/api/v1/invoices/:id/payments

/api/v1/payments

/api/v1/expenses

/api/v1/suppliers
/api/v1/bills

/api/v1/bank-accounts
/api/v1/bank-transactions
/api/v1/bank-imports
/api/v1/reconciliation

/api/v1/accounts
/api/v1/journals
/api/v1/periods

/api/v1/compliance
/api/v1/tax-codes
/api/v1/withholdings
/api/v1/service-exports

/api/v1/documents

/api/v1/reports/profit-loss
/api/v1/reports/balance-sheet
/api/v1/reports/trial-balance

/api/v1/audit
```

All organisation-specific endpoints derive and verify organisation access from authenticated context.

Do not trust an `organization_id` sent by the frontend without permission validation.

---

# 82. API Error Format

Use predictable errors.

```json
{
  "error": {
    "code": "INVOICE_ALREADY_ISSUED",
    "message": "This invoice has already been issued.",
    "details": {}
  }
}
```

User messages should remain understandable.

---

# 83. Validation

Use shared validation schemas where possible.

Validate:

- Currency
- Money
- Dates
- Tax configuration
- Payment allocations
- Invoice totals
- Journal balance
- Organisation ownership
- Locked periods
- Document permissions

Never rely solely on browser validation.

---

# 84. Security

Minimum requirements:

- Secure sessions.
- CSRF protection where applicable.
- Secure cookies.
- Rate limiting.
- Passwordless/OAuth or strong password support.
- Optional 2FA later.
- RBAC.
- Organisation scoping.
- Input validation.
- Output escaping.
- Parameterized queries/ORM.
- Signed object-storage URLs.
- Secrets in environment/secret manager.
- No gateway secrets in frontend.
- Webhook signature validation.
- Audit sensitive actions.
- Encryption for selected sensitive fields.
- Regular dependency scanning.
- Backups.

---

# 85. Data Isolation

Every repository/service method for tenant-owned data must accept an organisation context.

Bad:

```ts
findInvoice(id)
```

Preferred:

```ts
findInvoice({ organizationId, invoiceId })
```

Composite database indexes should frequently include:

```text
organization_id
```

Future row-level security may be considered, but service-layer scoping is mandatory regardless.

---

# 86. Backups

Production requirements:

```text
Daily PostgreSQL backup
Point-in-time recovery where available
Object storage versioning
Encrypted backup storage
Backup retention policy
Restore test
```

A backup is not considered valid until restoration has been tested.

---

# 87. Data Export

From the first release provide owner-controlled export.

Export:

```text
Customers
Suppliers
Invoices
Payments
Expenses
Bills
Bank transactions
Chart of accounts
Journals
Documents index
Financial reports
```

Future SaaS must never trap the customer's business data.

---

# 88. Observability

Use:

```text
Structured logs
Error tracking
Health endpoints
Queue monitoring
Database metrics
Application metrics
```

Never log:

- Full card details
- Passwords
- Secrets
- Sensitive uploaded documents

Use correlation/request IDs.

---

# 89. Performance

Initial internal usage is low-volume, but do not create obviously unscalable patterns.

Requirements:

- Pagination on transaction tables.
- Database indexes.
- Avoid N+1 queries.
- Cache expensive reports only when required.
- Report queries should work from ledger data.
- Background process heavy exports.
- Do not prematurely introduce microservices.

---

# 90. Architecture Style

Build a **modular monolith**.

Not microservices.

Deploy:

```text
Web
API
Worker
PostgreSQL
Redis
Object Storage
```

Accounting/payment modules remain logically separated but can live in one API application.

If Avyro becomes a large SaaS later, modules can be extracted when real scaling requirements justify it.

---

# 91. Deployment Architecture

Example:

```text
                 Cloudflare
                     │
                 Nginx/Caddy
                     │
          ┌──────────┴──────────┐
          │                     │
       Next.js               NestJS
          │                     │
          └──────────┬──────────┘
                     │
                PostgreSQL

NestJS ───── Redis / BullMQ

NestJS ───── Cloudflare R2

Gateway ───▶ webhook endpoint
```

Containerise with Docker.

---

# 92. Environments

Use:

```text
local
staging
production
```

Never test gateway webhooks against production data if sandbox/test facilities exist.

Use separate databases and storage buckets.

---

# 93. Seeds

Provide deterministic development seeds.

Seed:

```text
Organisation:
Miriyam Core

Customer:
Inoryum Ltd

Bank:
EBL Business BDT

Accounts:
Default chart

Project:
Example Software Development Project

Invoices:
Draft
Issued
Paid
Overdue

Expenses:
Hosting
Internet
Software Subscription

Gateway:
Mock Provider
```

Never seed fake data into production.

---

# 94. Mock Payment Gateway

Before integrating real gateways, build:

```text
MockGatewayProvider
```

It should simulate:

```text
Successful payment
Failed payment
Duplicate webhook
Partial refund
Settlement
Gateway fee
```

This enables reliable accounting tests.

---

# 95. Testing Strategy

## Unit tests

Highest priority:

```text
AccountingPostingService
Invoice calculations
Payment allocation
FX calculations
Tax code calculations
Gateway settlement calculation
Period locking
Owner transaction rules
```

## Integration tests

Test:

```text
Invoice → journal
Invoice → payment → journal
Payment → settlement → bank
Expense → journal
Bill → payment
Bank import → reconcile
Credit note → journal
Period locking
```

## End-to-end tests

Critical user flows:

```text
Onboard company
Add customer
Create invoice
Issue invoice
Record payment
Upload bank statement
Match payment
Open P&L
Record expense
Close month
```

Use Playwright.

---

# 96. Accounting Invariants

Automated tests must enforce:

1. Posted journals always balance.
2. Posted journals cannot be edited.
3. Locked-period records cannot be changed without authorised reopening.
4. Invoice outstanding amount cannot be negative except supported credit scenarios.
5. Payment allocations cannot exceed payment balance.
6. Bank transaction cannot be reconciled twice.
7. Gateway webhook idempotency works.
8. Currency/base amount is preserved.
9. Owner drawings do not hit operating expense.
10. Transfers do not hit revenue.
11. Customer payments do not create duplicate revenue.
12. Gateway settlement does not create duplicate revenue.

These should be treated as product integrity tests.

---

# 97. UX Tests

Do not only test code.

Test product simplicity.

A fresh user should be able to:

```text
Create first customer
Create and issue invoice
Record first expense
Import bank CSV
Match payment
View profit
```

without reading accounting documentation.

Use user-facing terminology consistently.

---

# 98. Accessibility

Baseline:

- Keyboard navigation.
- Visible focus states.
- Semantic HTML.
- Labels on form controls.
- Good contrast.
- Screen-reader-readable tables.
- Do not communicate status by colour alone.
- Responsive layouts.

---

# 99. Mobile / Responsive Behaviour

Desktop is primary for accounting work.

Mobile must support:

```text
Dashboard
Invoice lookup
Payment status
Expense entry
Receipt upload
Approvals
Notifications
```

Do not try to compress advanced general-ledger tables into unusable mobile grids.

---

# 100. Design Direction

Visual direction:

- Calm
- Modern
- Professional
- Dense only where accounting tables require it
- Large whitespace in forms and dashboards
- Strong typography
- Minimal decoration
- Clear status badges
- Neutral UI
- Excellent dark/light mode if implemented

Avoid:

- Generic admin-template appearance
- Too many coloured cards
- Giant gradients
- Finance-bro aesthetics
- ERP clutter

The system should feel closer to a polished modern SaaS application than traditional accounting software.

---

# 101. Financial Year Configuration

Do not hard-code calendar-year assumptions.

Store:

```text
fiscal_year_start_month
fiscal_year_start_day
```

Generate periods based on organisation configuration.

Allow accountant confirmation before first live period.

---

# 102. Opening Balances

Provide a guided opening balance flow.

If starting Avyro from the beginning of business:

```text
Opening balances may mostly be zero.
```

If migrating later:

```text
Bank balances
Accounts receivable
Accounts payable
Owner capital
Assets
Liabilities
```

should be entered through a controlled opening journal.

---

# 103. Month-End Workflow

Create a guided close checklist:

```text
August 2026

✓ All bank statements imported
✓ Bank accounts reconciled
✓ Gateway settlements reconciled
! 2 expenses missing receipts
✓ Customer payments allocated
✓ Supplier bills reviewed
✓ FX entries reviewed
✓ Tax/VAT review
✓ Draft reports generated

[Close August]
```

This makes accounting approachable.

---

# 104. Accountant Review Queue

Instead of forcing the owner to understand every edge case, allow records to be marked:

```text
Needs Accountant Review
```

Examples:

- Unsure expense category
- Unknown tax treatment
- FX issue
- Withholding certificate mismatch
- Opening balance question

Accountant sees one queue.

---

# 105. Notes & Comments

Allow internal comments on records.

Example:

```text
Invoice MC-2026-001

Salehin:
"Payment received through PortWallet; settlement expected tomorrow."

Accountant:
"Matched settlement and processing fee."
```

Comments do not alter accounting.

---

# 106. Approval Architecture

V1 may not require approvals, but model future states.

Potential approval workflows:

```text
Expense approval
Supplier bill approval
Manual journal approval
Payment approval
Period reopening approval
```

Do not force approvals for one-owner Miriyam Core initially.

---

# 107. Email Architecture

Invoices should be sendable by email.

Store:

```text
email_logs

entity_type
entity_id
recipient
subject
provider_message_id
status
sent_at
```

Email templates:

```text
Invoice issued
Payment receipt
Invoice reminder
Overdue invoice
Quote
```

Do not make email sending a requirement for invoice issuance.

---

# 108. Invoice Reminders

Configurable schedule:

```text
3 days before due
On due date
7 days overdue
```

For internal V1, reminders can initially create a notification/draft rather than automatically emailing customers.

---

# 109. Recurring Invoices

Later milestone.

Template:

```text
Customer
Items
Frequency
Start
End
Auto-create draft
Auto-send?
```

Default:

```text
Auto-create draft
Manual approval before sending
```

This is safer initially.

---

# 110. Tags / Dimensions

Avoid uncontrolled tag chaos.

Provide structured dimensions:

```text
Customer
Project
Account
Country
Tax code
```

A lightweight custom tag feature may exist for reporting, but should not replace proper entities.

---

# 111. Cost Centres

Future-ready optional field:

```text
cost_center_id
```

Do not expose initially unless Miriyam Core needs departments.

---

# 112. Import Architecture

Future SaaS will need migration.

Create import framework for:

```text
Customers
Suppliers
Invoices
Expenses
Chart of accounts
Bank transactions
Opening balances
```

Import lifecycle:

```text
Upload
Map
Validate
Preview
Commit
Report errors
```

Imports must be resumable or safely repeatable.

---

# 113. Soft Delete Rules

Master data such as an unused customer may be archived.

Financial documents should generally be:

```text
voided / reversed / archived
```

rather than deleted.

Implement per-entity policies.

---

# 114. Status Machine

Use explicit allowed transitions.

Example invoice:

```text
DRAFT → ISSUED
ISSUED → PARTIALLY_PAID
ISSUED → PAID
ISSUED → VOID (subject to rules)
PARTIALLY_PAID → PAID
```

Do not permit arbitrary status strings.

---

# 115. Currency Formatting

Use ISO currency metadata.

Examples:

```text
BDT → ৳
GBP → £
USD → $
EUR → €
```

Display currency code where symbol could be ambiguous.

---

# 116. Number Formatting

For Bangladesh locale, allow configured formatting preferences.

Do not store formatted strings.

Store numeric values, format in presentation layer.

---

# 117. Compliance Sources

Maintain a compliance references table in the application/documentation.

Example fields:

```text
authority
title
source_url
published_date
effective_date
last_reviewed_at
notes
```

For Bangladesh, sources should prioritise official authorities such as:

- National Board of Revenue (NBR)
- Bangladesh Bank
- Relevant government/licensing authority

The software must distinguish:

```text
System capability
```

from:

```text
Current legally applicable treatment
```

---

# 118. Compliance Update Process

Before changing compliance logic:

```text
1. Record official source
2. Add effective date
3. Add/update rule configuration
4. Write tests
5. Review existing transactions
6. Deploy
```

Never retroactively recalculate posted historical transactions simply because a rule changed.

---

# 119. Initial Miriyam Core Configuration

Create production onboarding data approximately as:

```text
Organisation:
Miriyam Core

Country:
Bangladesh

Legal type:
Sole Proprietorship

Business activity:
Software Nirmata Protishthan

Base currency:
BDT

Timezone:
Asia/Dhaka

Default invoice prefix:
MC
```

Do not seed real IDs such as TIN/BIN/trade licence unless entered by the owner.

---

# 120. Initial Inoryum Relationship

Create Inoryum Ltd as a foreign customer.

```text
Customer:
Inoryum Ltd

Country:
United Kingdom

Currency:
GBP

Related Party:
Yes

Type:
Business
```

Attach the subcontract agreement once executed.

Future invoices should be linked to the agreement/project where applicable.

---

# 121. Evidence Workflow for Inoryum Payment

Ideal system workflow:

```text
Inoryum contract
     ↓
Miriyam Core project
     ↓
Invoice MC-...
     ↓
Payment
     ↓
Payment gateway / bank evidence
     ↓
Settlement
     ↓
EBL bank transaction
     ↓
Reconciliation
     ↓
Journal
     ↓
Export/service evidence record
     ↓
Financial reports
```

The UI should automatically connect as many of these records as possible.

---

# 122. Phase 0 — Foundation

Goal:

Create a maintainable application shell.

Build:

```text
Monorepo
Next.js
NestJS
PostgreSQL
Prisma
Authentication
Organisation
RBAC
Audit foundation
R2 abstraction
Docker
CI
Test setup
```

Definition of done:

- User can sign in.
- Miriyam Core organisation exists.
- Permissions work.
- Database migrations work.
- CI tests run.
- Staging deploy works.

---

# 123. Phase 1 — Accounting Core

Goal:

Build the trustworthy ledger before feature expansion.

Build:

```text
Chart of accounts
Accounts
Journals
Journal lines
Posting service
Accounting periods
Opening balances
Basic trial balance
Audit
```

Definition of done:

- Balanced journal enforcement.
- Posted immutability.
- Period locking.
- Trial balance balances.
- Posting service thoroughly unit-tested.

Do not continue to complex financial workflows until this is stable.

---

# 124. Phase 2 — Sales

Build:

```text
Customers
Contracts
Projects
Quotes
Invoices
Invoice items
Credit notes
Payments
Invoice PDFs
Customer view
```

Automatic postings required.

Definition of done:

```text
Create customer
Create invoice
Issue
Record partial payment
Record full payment
Credit invoice
See receivable
See revenue
```

No manual journal should be required.

---

# 125. Phase 3 — Expenses & Payables

Build:

```text
Suppliers
Expenses
Receipt upload
Bills
Bill items
Bill payments
```

Definition of done:

- Expense recording posts correctly.
- Supplier bill appears in payable aging.
- Payment closes bill.
- Receipts attach correctly.
- Expense report works.

---

# 126. Phase 4 — Banking

Build:

```text
Bank accounts
CSV/XLSX imports
Bank transactions
Duplicate detection
Reconciliation UI
Transfers
Reconciliation suggestions
```

Definition of done:

- Import EBL-compatible sample CSV mapping.
- Match invoice payment.
- Match expense.
- Record transfer.
- Reconciliation balance is explainable.

---

# 127. Phase 5 — Multi-Currency

Build:

```text
Currency model
Exchange rates
Original/base values
Foreign invoice
Foreign payment
FX gain/loss
```

Definition of done:

- GBP invoice can be issued.
- BDT ledger remains correct.
- Original GBP amount remains visible.
- Payment at a different exchange rate posts FX difference correctly.

---

# 128. Phase 6 — Payment Gateways

First implement:

```text
MockGateway
```

Then select real provider.

Build:

```text
Gateway abstraction
Checkout
Webhook
Payment verification
Clearing account
Settlement
Fees
Bank matching
Refund framework
```

Definition of done:

```text
Invoice
→ payment page
→ successful gateway event
→ payment
→ gateway clearing
→ settlement
→ processing fee
→ bank reconciliation
```

without duplicate revenue.

---

# 129. Phase 7 — Bangladesh Compliance Layer

Build framework:

```text
Compliance profile
Trade licence records
TIN record
BIN/VAT record
Effective-dated tax rules
Tax codes
Withholding
VAT document framework
Compliance periods
Export/service evidence
Expiry reminders
```

Important:

Do not make automatic filing claims.

Review actual production configuration with a qualified Bangladesh professional.

---

# 130. Phase 8 — Reports

Build and validate:

```text
P&L
Balance Sheet
Trial Balance
General Ledger
Cash Flow
AR Aging
AP Aging
Revenue by customer
Expense by category
Export revenue
Related-party report
```

Every report should drill down.

---

# 131. Phase 9 — Usability Polish

Do not treat this as optional.

Run full UX review.

Improve:

```text
Onboarding
Quick Create
Command palette
Empty states
Keyboard navigation
Saved defaults
Search
Filters
Mobile expense flow
Reconciliation flow
Month-end checklist
Accountant Review Queue
```

Measure:

> Can a smart business owner use it without knowing accounting?

If not, simplify.

---

# 132. Phase 10 — Operations

Only after finance foundation works.

Add as needed:

```text
Assets
People
Timesheets
Payroll
Advanced project profitability
```

---

# 133. Future SaaS Conversion

When ready to commercialise Avyro:

Add:

```text
Public registration
Workspace onboarding
Organisation switcher
Invitations
Subscription plans
Usage limits
SaaS billing
Super-admin
Tenant support tools
Data importers
Public API
Webhooks
Accountant access
Feature flags
Product analytics
```

The core accounting schema should remain intact.

---

# 134. SaaS Plan Concepts — Future Only

Do not implement now.

Potential future plans:

```text
Starter
Business
Accountant
```

Potential limits:

```text
Organisations
Users
Invoices
Storage
Advanced reporting
Bank connections
Payroll
API
```

Do not constrain Miriyam Core internal installation through artificial SaaS limits.

---

# 135. Feature Flags

Use feature flags for modules that may be experimental.

Examples:

```text
gateway_portwallet
payroll
advanced_fx
vat_exports
ai_categorization
```

Do not scatter raw environment-condition checks through UI.

---

# 136. AI — Future

Do not make AI foundational.

Possible future assistance:

```text
Expense categorisation suggestions
Bank matching suggestions
Receipt extraction
Anomaly detection
Natural-language report queries
Document classification
```

Rules:

- AI suggests.
- Accounting engine validates.
- AI never directly posts unbalanced journals.
- Material automated actions require transparent review.

---

# 137. Suggested Homepage Copy — Internal

```text
Avyro

Miriyam Core

Your business, accounted for.
```

No need to brand heavily while internal.

---

# 138. Development Rules for Codex / Cursor

These rules are mandatory.

## Never

- Put accounting calculations only in React components.
- Write ledger rows directly from controllers.
- Use floating-point numbers for money.
- Hard-code Miriyam Core IDs.
- Hard-code current Bangladesh tax rates into source logic.
- Delete posted journals.
- Trust frontend organisation IDs without authorization.
- Mark invoice paid without a payment/allocation record.
- Treat gateway settlement as new revenue.
- Treat bank transfer between own accounts as revenue/expense.
- Treat owner withdrawal as business expense.
- Silently update historic exchange rates.
- Let duplicate webhooks duplicate payments.
- Build microservices for V1.
- Add an AI layer before accounting correctness exists.

## Always

- Scope tenant data to organisation.
- Use database transactions for accounting workflows.
- Create journal entries through AccountingPostingService.
- Audit significant changes.
- Preserve source documents.
- Preserve original currency.
- Use effective-dated compliance configuration.
- Write tests for financial invariants.
- Prefer understandable UI language.
- Keep Simple Mode simple.

---

# 139. Coding Standards

Use:

```text
TypeScript strict mode
ESLint
Prettier
Clear domain naming
Small services
Explicit DTOs
Zod/shared validation where useful
Prisma migrations
Conventional commits
```

Avoid:

```text
any
giant service classes
business logic in controllers
business logic in UI
untyped JSON everywhere
magic strings
silent catches
```

---

# 140. Documentation Required in Repository

Create:

```text
README.md

docs/
  PRODUCT.md
  ARCHITECTURE.md
  ACCOUNTING.md
  POSTING_RULES.md
  DATABASE.md
  API.md
  SECURITY.md
  DEPLOYMENT.md
  COMPLIANCE_BD.md
  TESTING.md
```

`COMPLIANCE_BD.md` must contain a clear disclaimer that rules must be verified against current official sources before production use.

---

# 141. ADRs

Use Architecture Decision Records for major decisions.

Examples:

```text
ADR-001 Modular monolith
ADR-002 Double-entry ledger
ADR-003 PostgreSQL + Prisma
ADR-004 Multi-tenant-ready organisation scoping
ADR-005 Immutable posted journals
ADR-006 Gateway clearing accounts
ADR-007 Effective-dated compliance rules
ADR-008 Simple Mode / Accountant Mode
```

---

# 142. Definition of MVP

The MVP is **not** complete merely because screens exist.

MVP is complete when Miriyam Core can genuinely run its core bookkeeping inside Avyro.

Required real-world flow:

```text
1. Create Miriyam Core
2. Add business bank account
3. Add Inoryum Ltd
4. Attach subcontract contract
5. Create GBP invoice
6. Issue invoice
7. Record payment
8. Record gateway/bank settlement
9. Import bank statement
10. Reconcile transaction
11. Record operating expenses
12. Attach receipts
13. View P&L
14. View Balance Sheet
15. View receivables/payables
16. View related-party activity
17. View service-export evidence chain
18. Close accounting month
19. Export accountant-ready reports
```

If this workflow feels difficult, the MVP is not finished.

---

# 143. Definition of "Super Easy"

This is a product acceptance criterion.

A normal business owner should be able to perform these tasks without understanding debit/credit:

| Task | Target interaction |
|---|---|
| Add customer | One short form |
| Create invoice | One page |
| Record expense | One short form |
| Upload receipt | Drag/drop or mobile upload |
| Record customer payment | Guided action |
| Reconcile obvious payment | One click after review |
| Record owner withdrawal | Explicit plain-language action |
| Find transaction | Global search |
| Understand profit | Dashboard/report without journal knowledge |
| Close month | Guided checklist |

Advanced accounting detail remains available but does not dominate the experience.

---

# 144. Product Success Criteria

For Miriyam Core:

- All business income is traceable.
- All business expenses are traceable.
- Bank activity can be reconciled.
- Owner/business money remains clearly separated.
- Foreign client invoices preserve original currency.
- Related-party transactions are identifiable.
- Supporting documents stay connected.
- Accounting reports can be generated at any time.
- Month-end bookkeeping is structured.
- An accountant can inspect the ledger.
- The owner can operate the system without becoming an accountant.

For future SaaS:

- Adding a second organisation does not require schema redesign.
- Country/compliance rules are pluggable/configurable.
- Payment providers are adapters.
- UI complexity can grow without breaking Simple Mode.

---

# 145. Recommended First Codex Prompt

After placing this specification in the repository as `SPEC.md`, give Codex/Cursor:

> Read `SPEC.md` completely before writing code.
>
> We are building Avyro, initially for Miriyam Core but architected as a future multi-tenant SaaS.
>
> Start with **Phase 0 only**. Do not implement later phases yet.
>
> Produce:
> 1. proposed repository structure,
> 2. architecture decisions,
> 3. dependency list,
> 4. Prisma foundation schema,
> 5. authentication/organisation/RBAC design,
> 6. Docker development environment,
> 7. CI configuration,
> 8. tests for organisation isolation.
>
> Follow all "Development Rules for Codex / Cursor" in SPEC.md.
>
> Before implementing, identify any contradiction in SPEC.md. If there is no blocking contradiction, proceed without redesigning the product.

Then progress phase by phase.

---

# 146. Prompt for Accounting Phase

After Phase 0 passes:

> Implement Phase 1 — Accounting Core from SPEC.md.
>
> Do not implement invoicing yet.
>
> Treat the accounting invariants as mandatory acceptance tests.
>
> Build the central AccountingPostingService architecture, balanced journals, posted-entry immutability, chart of accounts, accounting periods, opening balances, trial balance, audit history, and tests.
>
> Do not expose unnecessary accounting complexity in Simple Mode.
>
> Stop only when Phase 1's Definition of Done and accounting invariants pass.

---

# 147. Prompt for Each Later Phase

Use:

> Read SPEC.md and the existing codebase.
>
> Implement Phase N only.
>
> Preserve all previous accounting invariants.
>
> Do not introduce functionality assigned to later phases unless it is a necessary shared abstraction.
>
> Add migrations, backend services, API routes, UI, permissions, audit events, unit tests, integration tests, and end-to-end coverage required for this phase.
>
> Update repository documentation for decisions made.
>
> Do not redesign existing architecture unless a real contradiction or integrity problem is found.

---

# 148. Compliance Implementation Note

Bangladesh-specific compliance is intentionally modelled as a configurable layer rather than fixed legal logic.

Before enabling production compliance calculations/exports:

- Review current NBR requirements.
- Review current Bangladesh Bank requirements relevant to foreign service/software receipts.
- Confirm tax/VAT/withholding configuration with an appropriate Bangladesh professional.
- Record the effective date and source of each configured rule.
- Add regression tests.

The accounting engine should remain useful even if a specific compliance rule changes.

---

# 149. Initial Official Reference Categories

Maintain links to current official materials in `docs/COMPLIANCE_BD.md`, including as applicable:

- National Board of Revenue — Income Tax Acts/Rules.
- National Board of Revenue — VAT registration/eBIN/eVAT/forms.
- Bangladesh Bank — foreign exchange regulations.
- Bangladesh Bank — service export / software / ICT remittance rules.
- Relevant city corporation/local authority information for trade licence matters.

Do not use blogs as the authoritative configuration source when an official source exists.

---

# 150. Final Product Direction

Avyro should feel like this:

> The owner records what happened in the business.
>
> Avyro quietly turns it into correct books.
>
> The accountant can see everything underneath.
>
> Documents and bank evidence stay attached.
>
> Reports are always explainable.
>
> Bangladesh-specific requirements are supported without poisoning the core accounting architecture with hard-coded rules.
>
> Miriyam Core gets a clean financial history from day one.
>
> When the product is ready for the market, the same accounting engine becomes the foundation of Avyro SaaS.

That is the architecture to protect throughout development.

---

# 151. Bangladesh Statutory Completeness

This section extends the generic compliance architecture (§44–§53, §117–§118, §129, §148–§149) with Bangladesh-standard capabilities required for a software/service business such as Miriyam Core.

**Hard rule (unchanged):** rates, treatments, thresholds, Mushak layouts, and filing calendars are **effective-dated configuration**, never hard-coded into posting logic. Final production configuration must be reviewed by a qualified Bangladesh accountant/tax professional. Software output is not legal advice.

## 151.1 Identifiers and registrations

Validate and store:

```text
e-TIN   — 12-digit Taxpayer Identification Number
BIN     — 13-digit Business Identification Number (VAT)
```

`compliance_profiles` (and organisation settings) must support:

```text
tax_identifier          (e-TIN)
vat_identifier          (BIN)
nbr_circle / office metadata
trade_license_* fields
vat_registration_status
tin_registration_status
optional IRC/ERC flags (not required for pure services initially)
```

Do not seed real TIN/BIN into production or shared seeds unless entered by the owner.

## 151.2 Fiscal calendar default

Default Bangladesh income / fiscal year:

```text
fiscal_year_start_month = 7
fiscal_year_start_day   = 1
```

(1 July – 30 June). Fully overridable per organisation.

Generate:

- Monthly VAT / Mushak periods from organisation calendar
- Annual income-tax year periods from fiscal-year config

Never assume a calendar-year fiscal year in code.

## 151.3 Separate TDS and VDS

Do not collapse Bangladesh withholding into a single ambiguous “withholding” concept.

### TDS — Tax Deducted at Source (income tax)

```text
tds_sections
tds_rules          (effective-dated rates by section / payment nature)
tds_withholdings
```

### VDS — VAT Deducted at Source

```text
vds_rules          (effective-dated)
vds_certificates   (Mushak certificate linkage)
```

### Challans

```text
tax_challans

id
organization_id
challan_type          VAT | TDS | VDS | OTHER
amount
currency
payment_date
a_challan_reference
treasury_reference
period_id
source_transaction_type
source_transaction_id
document_id
status
```

Deposit reminders must use configured due rules, not hard-coded law text.

## 151.4 Mushak document suite

Map `vat_documents.document_type` (and exporters) to Mushak-oriented types. V1 prepares/exports worksheets and registers; **does not auto-submit** to NBR portals.

| Type | Purpose |
|---|---|
| MUSHAK_6_1 | Purchase register |
| MUSHAK_6_2 | Sales register |
| MUSHAK_6_2_1 | Purchase-sales register |
| MUSHAK_6_3 | VAT tax invoice |
| MUSHAK_6_6 / MUSHAK_6_10 | VDS certificate variants (as configured) |
| MUSHAK_6_7 | Credit note |
| MUSHAK_6_8 | Debit note |
| MUSHAK_9_1 | Monthly VAT return worksheet |

Sales and AP must support **debit notes** as well as credit notes where Mushak 6.8 applies.

Renderers/exporters evolve independently of the ledger.

## 151.5 VAT treatment model

Configurable semantic treatments (examples; rates come from config):

```text
STANDARD
REDUCED_SRO
ZERO_RATED_EXPORT_SERVICE
EXEMPT
OUTSIDE_SCOPE
NOT_REGISTERED
TURNOVER_TAX
```

Organisation may operate under a **turnover tax** alternative regime flag when configured as eligible — posting and reports must respect the active regime for the transaction date.

IT/ITES exemption windows, if applicable, are stored as effective-dated rules — never assumed permanent in code.

## 151.6 Reverse-charge VAT on imported services

Software businesses commonly buy foreign SaaS/cloud services.

Expense / supplier bill fields:

```text
imported_service_reverse_charge   boolean
reverse_charge_tax_code_id
```

`AccountingPostingService` must post reverse-charge VAT and eligible input credit according to the effective-dated rule, and allow linking bank remittance / challan evidence.

## 151.7 Input Tax Credit (ITC)

Per purchase line / tax component:

```text
itc_status     CLAIMABLE | BLOCKED | APPORTIONED | NOT_APPLICABLE
itc_amount
```

Mushak purchase register exports must reflect ITC status.

Apportionment for mixed supplies may be Accountant Mode only in V1; Simple Mode stays plain-language.

## 151.8 Service-export / remittance evidence

Extend `service_export_records` checklist templates with Bangladesh-oriented items:

```text
Contract
Invoice
Payment
Gateway / OPGSP settlement evidence
Bank credit advice / remittance message
Proceeds / bank realisation evidence
Form-C / Form-C (ICT) when amount exceeds configured threshold
AD bank purpose / code notes
ERQ retention account linkage (optional)
Supporting documents
```

Thresholds for Form-C requirements are **configuration**, reviewed against current Bangladesh Bank circulars before production use.

Optional **ERQ (Exporter Retention Quota)** foreign-currency retention accounts may link to bank/ledger accounts; retention percentages are configured, not hard-coded.

Evidence Chain View (§52) must surface Form-C / ERQ / realisation status chips.

## 151.9 Statutory retention

Soft product policy:

```text
Retain VAT / tax / challan / Mushak-linked documents ≥ 5 years from period end.
```

Archive; do not hard-delete compliance documents.

## 151.10 Income-tax evidence pack (sole proprietorship)

Miriyam Core initial legal type is sole proprietorship:

- No RJSC / BFRS statutory financial-statement filing in V1
- Provide an accountant **evidence pack** export:

```text
Profit & Loss (management accounts)
Balance Sheet (management accounts)
Sales / purchase summaries
Bank reconciliations
Owner capital / drawings schedule
Related-party schedule
Export remittance schedule
Asset register
Challan register
```

If organisation later becomes a company, future work may add BFRS + audit packaging — **do not build RJSC filing in V1**.

## 151.11 Invoice PDF / Mushak 6.3 fields

When VAT-registered / Mushak 6.3 mode is enabled for an organisation:

```text
Supplier legal name, address, BIN
Buyer name, address, TIN/BIN if present
Taxable value, VAT amount, treatment code
Sequential Mushak-compatible invoice series (may differ from internal MC-YYYY-####)
```

Internal commercial numbering (`MC-2026-0001`) may coexist with Mushak series.

## 151.12 NBR-approved software readiness

When statutory turnover crosses NBR-mandated software thresholds, product may require NBR approval for VAT register maintenance.

V1 ships as an **internal Miriyam Core** system with Mushak-capable registers/exports. NBR approval is an operations milestone, not a Phase 0–2 blocker.

## 151.13 Chart of accounts — Bangladesh defaults

In addition to §11, seed (editable) accounts such as:

```text
VAT Payable
VAT Receivable / Input Tax Credit
VDS Payable
TDS Payable
Reverse Charge VAT Control
ERQ / Foreign Currency Retention (if used)
FX Gain
FX Loss
```

## 151.14 Compliance calendar and reminders

Configurable reminders (defaults illustrative only):

```text
Mushak-9.1 worksheet due within 15 days after month end
TDS / VDS deposit due dates
Trade licence / TIN / BIN expiry
Form-C pending above configured remittance threshold
Month-end close checklist
Income-year-end evidence pack
```

## 151.15 Debit notes

Domain support:

```text
debit_notes
debit_note_items
```

With automatic posting through `AccountingPostingService` and Mushak 6.8 export linkage where configured.

## 151.16 Phase mapping

Bangladesh statutory work is concentrated in Phase 7, with earlier hooks:

| Phase | BD additions |
|---|---|
| 0 | COMPLIANCE_BD.md, §151, fiscal-year default, TIN/BIN fields |
| 1 | BD CoA accounts (VAT/TDS/VDS/FX/ERQ) |
| 2 | Mushak 6.3 invoice fields; debit notes; related party |
| 3 | Reverse-charge imported services; TDS/VDS on payables |
| 4–6 | Remittance matching; ERQ FC; OPGSP evidence hooks |
| 7 | Full Mushak registers, 9.1 worksheet, challans, Form-C, ITC, calendar |
| 8 | Income-tax evidence pack export |
| 9 | Plain-language BD reminders |

## 151.17 Non-goals (compliance)

- Auto-submit to NBR or Bangladesh Bank portals in V1
- Hard-coded current SRO rates or Form-C thresholds in source
- Claiming software configuration is legal/tax advice
- Full company BFRS / RJSC filing before incorporation need exists
