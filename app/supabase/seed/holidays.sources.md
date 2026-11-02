# holidays.json sources (verify before release, Task 19)

`holidays.json` holds general (public) holidays only, not optional or restricted ones.
2026 is from the official state lists. 2027 is PROVISIONAL (see "2027 provisional rows" below):
the three states had not published their 2027 lists when it was added
(2026-11-01). Replace the 2027 rows with the official lists once they are out.

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

## 2027 provisional rows (added 2026-11-01)

Every 2027 row has "(provisional)" in its name. Replace them all with the official
G.O. / DPAR lists when they are published (usually late Nov to mid Dec 2026).

How the rows were chosen:
- A 2027 row exists for a state only if that state's 2026 general list has the same
  holiday. The names are copied from the 2026 rows.
- Dates come from Google Calendar's public "Holidays in India" feed
  (en.indian#holiday@group.v.calendar.google.com, fetched 2026-11-01), using both its
  public holidays and its observances.
- Days derived from a feed date: Bhogi is Sankranti minus 1, Kanuma is Sankranti plus 1,
  "Following day of ..." is plus 1. Sankranti is taken as 01-15, Google's Pongal date.
  In 2026 Google put Makar Sankranti a day earlier than the states did.
- Fixed-date holidays use their usual date: Ambedkar 04-14, Jagjivan Ram 04-05,
  May Day 05-01, Kannada Rajyothsava 11-01, Boxing Day 12-26.
- Karnataka also gets Valmiki Jayanthi, Naraka Chaturdashi and Kannada Rajyothsava. In 2026
  these were general holidays that were left off the list only because they fell on a Sunday.
- Left out because Google's feed does not give a date: Bonalu (Telangana),
  Basava Jayanthi and Kanakadasa Jayanthi (Karnataka), and Vara Lakshmi Vratham (Andhra Pradesh).

Known risk: dates set by the moon can be a day off from the state list. In 2026 the states
differed from Google by one day for Holi, Rama Navami, Durgashtami/Bathukamma, Bakrid
(TG/AP), Karnataka Mahanavami/Vijayadasami and Balipadyami, and AP Eid/Milad. Google marks
the 2027 Eid, Bakrid, Muharram and Milad dates as tentative.
