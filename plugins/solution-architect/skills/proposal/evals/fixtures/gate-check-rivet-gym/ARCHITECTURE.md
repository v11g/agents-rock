# Rivet Gym Member App — Architecture

## 1. Goals & Scope

Rivet Gym has three sites and about 900 members. Class booking is a shared
spreadsheet and a WhatsApp group; memberships are chased by hand each month. The
app lets a member book a class, see their membership status, and gives staff a
door-check screen.

| Goal | Measure | src |
|---|---|---|
| Members book classes themselves | 80% of bookings made without staff | stated |
| Staff stop chasing lapsed memberships | lapsed members flagged automatically | stated |

## 2. Constraints

| Constraint | src |
|---|---|
| Three sites, one membership list | stated |
| Card payments stay with the existing provider — no payment rebuild | stated |

## 4. Solution Strategy

A member-facing mobile web app over a single class schedule and membership
record, plus a staff door-check screen. Payments stay with the current provider;
the app reads membership status from it.

## 6. Core Components

| Component | Responsibility | src |
|---|---|---|
| `booking` | Class schedule, capacity and member bookings | proposed |
| `membership` | Membership status, lapse flags, staff door check | proposed |
| `payments` | Not estimated — existing provider stays | stated |

## 7. Runtime Behaviour

A member opens the schedule, books a class against remaining capacity, and gets
a confirmation. Staff scan the door-check screen at entry, which reads
membership status. A nightly job flags lapsed memberships for staff follow-up.

## 8. Data Stores

| Store | Holds | src |
|---|---|---|
| Primary relational database | members, classes, bookings, lapse flags | proposed |

## 15. Risks & Technical Debt

| Risk | Impact | src |
|---|---|---|
| The payment provider's membership status API is undocumented | lapse flagging may need rework | observed |
| Class capacity rules differ per site | one schedule model may not fit all three | stated |
