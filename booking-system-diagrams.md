# Booking System — Diagrams

Mermaid diagrams. GitHub renders these natively; in VS Code install the "Markdown Preview
Mermaid Support" extension, then open Preview (`Ctrl+Shift+V` / `Cmd+Shift+V`).

## ER diagram

No `Slot` table — availability is computed on demand from `Resource.workingHoursStart/End`
minus existing `Booking` rows minus `Holiday`/`closedWeekdays`, not stored. See the "why no
Slot table" Q&A in `interview-prep-backend.md` (Phase 2 section) for the full reasoning.

```mermaid
erDiagram
  BUSINESS ||--o{ RESOURCE : has
  BUSINESS ||--o{ HOLIDAY : has
  BUSINESS ||--o{ USER : employs
  RESOURCE ||--o{ SERVICE : offers
  RESOURCE ||--o{ BOOKING : "booked at"
  SERVICE ||--o{ BOOKING : "used for"

  BUSINESS {
    uuid id PK
    string name
    string timezone
  }
  RESOURCE {
    uuid id PK
    uuid businessId FK
    string name
    string workingHoursStart
    string workingHoursEnd
    int_array closedWeekdays
  }
  SERVICE {
    uuid id PK
    uuid resourceId FK
    string name
    int durationMins
    decimal price
  }
  BOOKING {
    uuid id PK
    uuid resourceId FK
    uuid serviceId FK
    string bookingRef
    datetime startTime
    datetime endTime
    string customerName
    string status
    datetime checkedInAt
  }
  HOLIDAY {
    uuid id PK
    uuid businessId FK
    date date
    string reason
  }
  USER {
    uuid id PK
    uuid businessId FK
    string email
    string passwordHash
    string role
  }
```

## Customer booking & check-in flow

```mermaid
flowchart TD
    A["Browse & pick a slot<br/><i>Public, no login</i>"] --> B["Create booking<br/><i>Returns ref + QR code</i>"]
    B --> C["Arrive & show QR<br/><i>Or give booking ref</i>"]
    C --> D["Staff checks in<br/><i>Requires staff login</i>"]
    D --> E["Visit completed<br/><i>Status: COMPLETED</i>"]
```

## Staff queue management flow

```mermaid
flowchart TD
    A["Staff or admin logs in<br/><i>Gets a JWT token</i>"] --> B["Open the day's queue<br/><i>Pick resource + date</i>"]
    B -->|on arrival| C["Check in<br/><i>Status → CHECKED_IN</i>"]
    B -->|no-show| D["Mark no-show<br/><i>Status → NO_SHOW</i>"]
    C --> E["Complete visit<br/><i>Status → COMPLETED</i>"]
```
