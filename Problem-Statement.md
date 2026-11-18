# Problem Statement — College Parking Dashboard System

When a college manages parking with paper registers or separate spreadsheets, gate staff have to reconcile vehicle registrations, slot availability, parking passes, and entry and exit times while vehicles are waiting. An incomplete exit record can make a free slot appear occupied, and staff checking separate lists may have no quick way to tell whether a vehicle is registered. Administrators also need a reliable history to understand which times and areas see the most demand.

The project brings those tasks into one database-backed dashboard. It covers the Main Gate and Academic Block with a combined capacity of 50 cars and 100 bikes. The register updates as staff record parking movements, and the same records support daily activity and capacity planning.

| No. | Problem | Dashboard response |
|---:|---|---|
| 1 | Staff cannot quickly count free parking spaces. | Show total, occupied and available spaces on the overview. |
| 2 | A free space might be intended for another vehicle type. | Filter slots for cars or bikes. Reject mismatched assignments at check-in. |
| 3 | Staff need to tell drivers where to park. | Display each available slot with its number and location. |
| 4 | Verifying who owns a vehicle takes time. | Search by plate and show the linked student. |
| 5 | A vehicle may arrive before registration. | Return a clear message when its plate is absent from the register. |
| 6 | Spacing and case differences can create duplicate plates. | Standardize plate text and enforce a unique registration. |
| 7 | Staff need to know which vehicles are still inside. | Filter the parking log to show open visits and time spent inside. |
| 8 | Matching separate entry and exit records is error-prone. | Close the existing visit by recording the exit in the same row. |
| 9 | A vehicle may be checked in twice. | Enforce one open visit per vehicle. |
| 10 | Two staff members may choose the same available slot. | Enforce one active assignment per slot in the database. |
| 11 | An unrecorded exit can make a slot look occupied for hours. | Flag visits open for more than eight hours for staff review. |
| 12 | Validity is difficult to check when passes are stored separately. | Check pass dates during entry and show each pass's type and status. |
| 13 | Staff may miss upcoming pass expirations. | Flag passes expiring within seven days and list expired passes. |
| 14 | Finding a past visit in a long register takes time. | Search and filter by plate, date, student or slot. |
| 15 | Administrators need to know when the gate is busiest. | Chart entries and exits by time interval. |
| 16 | Daily arrival totals alone do not show simultaneous demand. | Calculate peak occupancy from overlapping parking visits. |
| 17 | Parking duration is difficult to summarize manually. | Show average duration for completed visits matching the log filters. |
| 18 | Demand differs between cars, bikes and parking areas. | Compare occupied spaces with capacity for each area and vehicle type. |

The current prototype assumes staff enter vehicle movements, student IDs and pass dates. Entry and exit records use Asia/Kolkata for display and reporting. The two parking areas use a provisional 60/40 capacity split pending an area-by-area count.
