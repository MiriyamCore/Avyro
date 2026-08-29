# Bangladesh Compliance Guide

**Status:** Configuration reference for Avyro  
**Audience:** Implementers, accountants configuring Miriyam Core  
**Related:** [`avyro-SPEC.md`](../avyro-SPEC.md) §44–§53, §117–§118, §129, §148–§151

---

## Disclaimer

Avyro provides **system capability** to store identifiers, calculate amounts from configured rules, prepare Mushak-oriented registers/worksheets, and keep remittance evidence.

It does **not** constitute legal, tax, or regulatory advice.

Before enabling production compliance calculations or exports:

1. Review current official sources (NBR, Bangladesh Bank, local licensing authority).
2. Confirm tax / VAT / withholding / remittance configuration with a qualified Bangladesh professional.
3. Record the effective date and source of each configured rule.
4. Add regression tests for configured rates and treatments.

Rates, thresholds, Mushak layouts, and filing calendars must live in **effective-dated configuration**, never hard-coded into posting logic.

Distinguish:

| Concept | Meaning |
|---|---|
| System capability | What the software can model and export |
| Current legally applicable treatment | What a professional configures for this organisation at this date |

---

## Identifier formats

| Identifier | Typical format | Purpose |
|---|---|---|
| e-TIN | 12 digits | Income tax |
| BIN | 13 digits | VAT registration |
| Trade licence | Authority-specific | Local business licence |

Validate format in the application; do not invent checksum rules without an official source.

---

## Fiscal calendar

Default for Bangladesh organisations:

```text
Fiscal / income year: 1 July – 30 June
```

Overridable per organisation (`fiscal_year_start_month` / `fiscal_year_start_day`).

VAT periods are typically monthly. Mushak-9.1 worksheet due date default (illustrative): within **15 days** after month end — confirm before production.

---

## Mushak map (V1 export / worksheet support)

| Code | Purpose | V1 behaviour |
|---|---|---|
| Mushak 6.1 | Purchase register | Generate/export from purchase & expense data |
| Mushak 6.2 | Sales register | Generate/export from sales data |
| Mushak 6.2.1 | Purchase-sales register | Generate/export where configured |
| Mushak 6.3 | VAT tax invoice | PDF/fields when VAT mode enabled |
| Mushak 6.6 / 6.10 | VDS certificates | Store + link; export as configured |
| Mushak 6.7 | Credit note | Link to credit notes |
| Mushak 6.8 | Debit note | Link to debit notes |
| Mushak 9.1 | Monthly VAT return | **Worksheet / export only** — no auto-submit |

V1 does **not** auto-submit to `vat.gov.bd` or other government portals.

---

## TDS vs VDS

| Engine | Tax type | Notes |
|---|---|---|
| TDS | Income tax deducted at source | Section-coded, effective-dated rates |
| VDS | VAT deducted at source | Certificate + deposit (challan) flow |

Track deposits via `tax_challans` (a-challan / treasury references).

---

## VAT treatments (configurable)

Semantic categories (rates from config):

- Standard
- Reduced (SRO)
- Zero-rated export of services
- Exempt (including time-bound IT/ITES windows when configured)
- Outside scope / not registered
- Turnover tax regime (organisation flag when eligible)

### Reverse-charge (imported services)

Foreign SaaS, cloud, and similar imported services may require reverse-charge VAT handling. Configure per expense/bill; post through `AccountingPostingService`; attach remittance/challan evidence.

### Input Tax Credit (ITC)

Track per line: claimable, blocked, apportioned, or not applicable. Purchase registers must reflect ITC status.

---

## Service export / remittance evidence

For overseas software/service income (e.g. Inoryum Ltd), maintain an evidence chain:

1. Contract  
2. Invoice  
3. Payment  
4. Gateway / OPGSP settlement (if any)  
5. Bank credit advice / remittance message  
6. Proceeds / bank realisation evidence  
7. Form-C / Form-C (ICT) when amount exceeds **configured** threshold  
8. AD bank purpose/code notes  
9. Optional ERQ (Exporter Retention Quota) FC retention account link  
10. Supporting documents  

Form-C thresholds and ERQ retention percentages are configuration — verify against current Bangladesh Bank circulars before production use.

Retention soft policy: keep VAT/tax/challan/Mushak-linked documents **≥ 5 years** from period end; archive, do not hard-delete.

---

## Sole proprietorship vs company

| Legal type | V1 expectation |
|---|---|
| Sole proprietorship (Miriyam Core) | Management accounts + NBR e-Return evidence pack; no RJSC/BFRS statutory filing |
| Company (future) | May require BFRS + audit packaging — out of scope until needed |

### Income-tax evidence pack (sole prop)

- Profit & Loss  
- Balance Sheet  
- Sales / purchase summaries  
- Bank reconciliations  
- Owner capital / drawings schedule  
- Related-party schedule  
- Export remittance schedule  
- Asset register  
- Challan register  

---

## Official source placeholders

Maintain links and last-reviewed dates here (update when verified):

| Authority | Topic | Source URL | Published / effective | Last reviewed |
|---|---|---|---|---|
| National Board of Revenue | Income Tax Acts/Rules | https://nbr.gov.bd | TBD | Not yet reviewed for production |
| National Board of Revenue | VAT / eBIN / Mushak / portal | https://vat.gov.bd / https://nbr.gov.bd | TBD | Not yet reviewed for production |
| Bangladesh Bank | Foreign exchange / service export remittance | https://www.bb.org.bd | TBD | Not yet reviewed for production |
| Local authority | Trade licence | TBD by city corporation | TBD | Not yet reviewed for production |

Do not use blogs as the authoritative configuration source when an official source exists.

---

## Miriyam Core configuration checklist

Use before go-live (owner + accountant):

- [ ] Organisation: Miriyam Core, Bangladesh, Sole Proprietorship, BDT, Asia/Dhaka  
- [ ] Fiscal year start confirmed (default 1 July)  
- [ ] Trade licence number + expiry entered (if held)  
- [ ] e-TIN entered (owner-supplied; not seeded)  
- [ ] BIN / VAT status decided (registered vs not / turnover tax)  
- [ ] NBR circle/office metadata entered if VAT-registered  
- [ ] Default invoice prefix `MC`  
- [ ] Chart of accounts reviewed (incl. VAT/TDS/VDS/FX/ERQ accounts)  
- [ ] Tax codes reviewed for domestic vs export service treatments  
- [ ] TDS sections relevant to suppliers configured (if applicable)  
- [ ] VDS rules configured (if applicable)  
- [ ] Reverse-charge treatment for imported SaaS/cloud configured  
- [ ] Form-C / remittance checklist thresholds configured from current BB rules  
- [ ] ERQ account created only if used  
- [ ] Inoryum Ltd marked related party, GBP, UK  
- [ ] Bank account(s) added (e.g. EBL Business BDT)  
- [ ] Accountant sign-off recorded with date and sources  

---

## Compliance update process

1. Record official source  
2. Add effective date  
3. Add/update rule configuration  
4. Write tests  
5. Review impact on existing transactions (do not silently rewrite history)  
6. Deploy  

Never retroactively recalculate posted historical transactions solely because a rule changed.
