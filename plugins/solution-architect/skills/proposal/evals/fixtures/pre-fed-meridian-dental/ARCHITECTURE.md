# Meridian Dental Patient Portal — Architecture

## 1. Goals & Scope

Meridian Dental Group is a four-chair practice. Patients phone reception to ask
what treatment they had and what they owe, and the six-month check-up recall is
a receptionist working through a paper list. The portal lets a patient sign in,
read their own treatment history and bills, and receive their recall reminder
automatically.

| Goal | Measure | src |
|---|---|---|
| Patients self-serve their history and bills | 40% of records enquiries handled without a call | stated |
| Recall stops being manual | 100% of six-month recalls sent automatically | stated |
| Every record view is accountable | an audit entry for every record opened | stated |

## 2. Constraints

| Constraint | src |
|---|---|
| Patient health records are protected data; access must be logged and retained seven years | stated |
| The practice management system stays the system of record; the portal reads a nightly export | stated |
| No insurance claims handling in v1 — the practice keeps its claims desk | stated |
| Hard budget ceiling set by the partners; scope is cut before the ceiling moves | stated |

## 4. Solution Strategy

A read-mostly patient portal in front of a nightly export from the practice
management system. Identity is email plus date of birth, verified at first
sign-in. Every record view writes an audit entry. Recall messages are scheduled
jobs sending through the practice's existing messaging provider.

## 6. Core Components

| Component | Responsibility | src |
|---|---|---|
| `portal` | Patient sign-in, session, consent and access rules | proposed |
| `records` | Treatment history and billing screens over the nightly export | proposed |
| `recall` | Scheduled six-month recall messages and opt-out handling | proposed |
| `insurance` | Not estimated — phase 2, practice keeps its current claims desk | stated |

## 7. Runtime Behaviour

A patient signs in with email and date of birth; first sign-in verifies against
the exported patient list. Record screens read the last nightly export and write
an audit entry per view. A daily job selects patients due a six-month recall and
sends the reminder, honouring opt-outs.

## 8. Data Stores

| Store | Holds | src |
|---|---|---|
| Primary relational database | portal accounts, consent, audit log (7-year retention) | stated |
| Nightly export snapshot | treatment history and balances, read-only | stated |

## 12. Security

Patient records are protected data. Access is per-patient: a signed-in patient
can read only their own record. Every view is written to an append-only audit
log retained seven years. Guardian access for under-16 patients is an open
question the practice must answer before build.

## 15. Risks & Technical Debt

| Risk | Impact | src |
|---|---|---|
| Practice management export format is undocumented | records screens may need rework after first export | observed |
| Guardian access rule undecided | affects the access rules in M1 | stated |
