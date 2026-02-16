# UAE PINT-AE Input Templates — Data Dictionary

**Spec Version:** PINT-AE 2025-Q2 · UAE DR v1.0.1
**Use Case:** UAE B2B Standard Invoice (UC1)
**Generated:** 2025-06-01

---

## Overview

These three CSV templates define the **input schema** for taxpayer/ERP data required to prepare UAE-compliant e-invoices under the PINT-AE standard. They include **only fields that are the responsibility of the taxpayer's ERP system (Corner 1)** or are required as inputs for existing validation rules.

Fields derived by the ASP (Corner 2) — such as Specification ID (IBT-024), Business Process Type (IBT-023), and tax scheme codes — are **excluded** from these templates.

---

## 1. Buyers Template (`buyers_template.csv`)

| # | Column | DR ID | Mandatory (UC1) | Type | Format | Description | Responsibility |
|---|--------|-------|------------------|------|--------|-------------|----------------|
| 1 | `buyer_id` | — | Yes | String | Free text | System join key (PK) | ERP |
| 2 | `buyer_name` | IBT-044 | Yes | String | Free text | Buyer legal name | ERP |
| 3 | `buyer_trn` | IBT-048 | Conditional (B2B) | String | 15-digit, starts with 1 | Buyer TRN | ERP |
| 4 | `buyer_address` | IBT-050 | Yes | String | Free text | Buyer street address | ERP |
| 5 | `buyer_country` | IBT-055 | Yes | Code | ISO 3166-1 α-2 | Country code | ERP |
| 6 | `buyer_city` | IBT-052 | Yes | String | Free text | City name | ERP |
| 7 | `buyer_subdivision` | IBT-054 | Conditional | Code | AE-AZ, AE-DU, etc. | UAE emirate code | ERP |
| 8 | `buyer_electronic_address` | IBT-049 | Yes | String | Endpoint ID | PEPPOL or email | ERP |

---

## 2. Invoice Headers Template (`invoice_headers_template.csv`)

| # | Column | DR ID | Mandatory (UC1) | Type | Format | Description | Responsibility |
|---|--------|-------|------------------|------|--------|-------------|----------------|
| 1 | `invoice_id` | — | Yes | String | Unique ID | System join key (PK) | ERP |
| 2 | `invoice_number` | IBT-001 | Yes | String | Unique per seller | Invoice number | ERP |
| 3 | `issue_date` | IBT-002 | Yes | Date | YYYY-MM-DD | Issue date | ERP |
| 4 | `invoice_type` | IBT-003 | Yes | Code | UNTDID 1001 (380/381/383) | Type code | ERP |
| 5 | `seller_trn` | IBT-031 | Yes | String | 15-digit | Seller TRN | ERP |
| 6 | `seller_name` | IBT-027 | Yes | String | Free text | Seller legal name | ERP |
| 7 | `seller_address` | IBT-035 | Yes | String | Free text | Seller street | ERP |
| 8 | `seller_city` | IBT-037 | Yes | String | Free text | Seller city | ERP |
| 9 | `seller_country` | IBT-040 | Yes | Code | ISO 3166-1 α-2 | Seller country | ERP |
| 10 | `seller_subdivision` | IBT-039 | Conditional | Code | Emirate code | Seller emirate | ERP |
| 11 | `seller_electronic_address` | IBT-034 | Yes | String | Endpoint ID | Seller endpoint | ERP |
| 12 | `seller_legal_reg_id` | IBT-030 | Yes | String | Trade license | Legal reg ID | ERP |
| 13 | `seller_legal_reg_id_type` | BTUAE-15 | Yes | Code | TL/EID/PAS/CD | ID type | ERP |
| 14 | `buyer_id` | — | Yes | String | FK → buyers | Join key | ERP |
| 15 | `currency` | IBT-005 | Yes | Code | ISO 4217 α-3 | Currency | ERP |
| 16 | `transaction_type_code` | BTUAE-02 | Yes | Code | 8-char binary | Transaction type | ERP |
| 17 | `payment_due_date` | IBT-009 | Conditional | Date | YYYY-MM-DD | Due date | ERP |
| 18 | `payment_means_code` | IBT-081 | Conditional | Code | UNTDID 4461 | Payment means | ERP |
| 19 | `fx_rate` | IBT-007 | Conditional | Number | Decimal (6dp) | FX rate to AED | ERP |
| 20 | `total_excl_vat` | IBT-109 | Yes | Number | Decimal (2dp) | Total excl. tax | ERP |
| 21 | `vat_total` | IBT-110 | Yes | Number | Decimal (2dp) | Total tax | ERP |
| 22 | `total_incl_vat` | IBT-112 | Yes | Number | Decimal (2dp) | Total incl. tax | ERP |
| 23 | `amount_due` | IBT-115 | Conditional | Number | Decimal (2dp) | Amount due | ERP |
| 24 | `tax_category_code` | IBT-118 | Yes | Code | S/Z/E/RC | Tax category | ERP |
| 25 | `tax_category_rate` | IBT-119 | Yes | Number | Percentage | Tax rate | ERP |

---

## 3. Invoice Lines Template (`invoice_lines_template.csv`)

| # | Column | DR ID | Mandatory (UC1) | Type | Format | Description | Responsibility |
|---|--------|-------|------------------|------|--------|-------------|----------------|
| 1 | `line_id` | IBT-126 | Yes | String | Unique ID | Line identifier (PK) | ERP |
| 2 | `invoice_id` | — | Yes | String | FK → headers | Join key | ERP |
| 3 | `line_number` | IBT-126 | Yes | Integer | Sequential | Line sequence | ERP |
| 4 | `description` | IBT-153 | Yes | String | Free text | Item description | ERP |
| 5 | `quantity` | IBT-129 | Yes | Number | Decimal | Invoiced quantity | ERP |
| 6 | `unit_of_measure` | IBT-130 | Yes | Code | UN/ECE Rec 20 | UOM code | ERP |
| 7 | `unit_price` | IBT-146 | Yes | Number | Decimal | Item net price | ERP |
| 8 | `line_discount` | IBT-136 | No | Number | Decimal (2dp) | Line discount | ERP |
| 9 | `line_total_excl_vat` | IBT-131 | Yes | Number | Decimal (2dp) | Line net amount | ERP |
| 10 | `vat_rate` | IBT-152 | Yes | Number | Percentage | VAT rate | ERP |
| 11 | `vat_amount` | BTUAE-08 | Yes (UC1) | Number | Decimal (2dp) | VAT line amount | ERP |
| 12 | `tax_category_code` | IBT-151 | Yes | Code | S/Z/E/RC | Item tax category | ERP |

---

## Data Relationships

```
┌─────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  buyers          │◄────│  invoice_headers       │────►│  invoice_lines    │
│                  │      │                        │      │                  │
│  PK: buyer_id    │      │  PK: invoice_id        │      │  PK: line_id     │
│                  │      │  FK: buyer_id           │      │  FK: invoice_id  │
└─────────────────┘      └──────────────────────┘      └──────────────────┘
```

- **`invoice_headers.buyer_id`** → **`buyers.buyer_id`** (Many-to-One)
- **`invoice_lines.invoice_id`** → **`invoice_headers.invoice_id`** (Many-to-One)

---

## Integrity Rules for Example Data

1. All `buyer_id` values in headers exist in buyers
2. All `invoice_id` values in lines exist in headers
3. `total_incl_vat = total_excl_vat + vat_total` (within ±0.01)
4. `line_total_excl_vat = quantity × unit_price - line_discount`
5. `vat_amount = line_total_excl_vat × (vat_rate / 100)`
6. All TRNs are 15-digit strings (not scientific notation)
7. All dates in YYYY-MM-DD format
8. Currency codes are ISO 4217 alpha-3
