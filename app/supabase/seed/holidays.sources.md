# holidays.json sources (verify before release, Task 19)

`holidays.json` holds general (public) holidays only, not optional or restricted ones.
Only 2026 is included. 2027 lists were not yet published by any of the three states
when this was compiled (2026-10-31), so no 2027 dates were added.

| Region | Year | Source | Verification |
|---|---|---|---|
| Telangana | 2026 | G.O.Rt.No.1715, General Administration (Spl.E), 06.12.2025, Annexure-I (27 general holidays). Copy read: https://bvrithyderabad.edu.in/wp-content/uploads/2026/01/Telangana-State-Holidays-2026.pdf | Read from the G.O. annexure itself (a college-hosted copy, not a gov.in URL). Eid and Milad dates may shift with moon sighting. |
| Karnataka | 2026 | DPAR notification No. DPAR 16 HHL 2025, 17.11.2025, Notification-I (20 general holidays). Scan read: https://ceg.karnataka.gov.in/frontend/opt1/pdfs/HOLIDAYSLIST2024.pdf | Read from the scanned notification image on a karnataka.gov.in host. Excludes holidays on Sundays and 2nd/4th Saturdays; Kodagu-only local holidays are not included. |
| Andhra Pradesh | 2026 | G.O.Rt.No.2276, General Administration (Political-B), 04.12.2025 (24 general holidays). Reproduction read: https://apgovtschool.blogspot.com/2025/12/holidays-for-2026-calendar-year.html | NOT read from an official government URL. Matches a second news report (https://www.oneindia.com/india/andhra-holidays-list-for-2026-full-list-of-state-govt-holidays-for-the-year-7944802.html). |

## Points to check by hand

- Andhra Pradesh Moharram: the original G.O. says 2026-06-25. A news report (https://www.telegraphindia.com/edugraph/news/andhra-pradesh-revises-muharram-school-holiday-schedule-for-2026-check-official-notice/cid/2165928) says G.O.Rt.No.1176 (15.06.2026) moved the general holiday to 2026-06-26. The file uses 2026-06-26. Not checked against the G.O. itself.
- Andhra Pradesh lunar holidays (Eid-ul-Fitr 03-20, Milad-un-Nabi 08-25) are as originally notified. Later revisions, if any, were not checked.
- Karnataka Valmiki Jayanthi: the notification lists 2026-10-25 (a Sunday) as excluded. One news report says Monday 2026-10-26 was later declared a holiday. That is not in `holidays.json`.
- Telangana G.O.Rt.No.376 (18.03.2026) made 2026-03-20 an optional holiday. It does not change the general list.
- Sunday dates (for example Telangana 2026-11-08) are kept because the G.O. lists them. They do not change scheduling when Sunday is already a non-working day.
