// Writes .data/samples/sample-credentialing.xlsx with FAKE data in the department's layout.
// Run: npx tsx scripts/make-sample.ts
import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";

const header = ["Inurances", "Participation", "Provider ID", "Effective date", "Remarks", "Follow", "Invoice Status"];

const sheet1 = [
  ["Sunrise Neuro Health"],
  ["Provider Name", "Jane Sample", "SSN", "000-12-3456", "Client file link for all updated Info"],
  ["NPI", 1234567893, "CAQH ID", 99887766, "https://docs.google.com/spreadsheets/d/EXAMPLE/edit"],
  ["Group NPI", 1234567801, "Phone Number", 2015550100],
  ["Tax ID", 111223333, "Fax Number", "201-555-0101"],
  ["Service adress", "100 Example Ave STE 1, Maywood, NJ 07607", "DEA", "AB1234567            EXP 02/28/2027", "Group NPI has been created by GenMeditech"],
  ["Billing adress", "100 Example Ave STE 1, Maywood, NJ 07607", "State Licence", "25MA00000000 04/28/2025 EXP 6/30/2027"],
  ["Speciality", "2084N0600X - Psychiatry & Neurology - Clinical Neurophysiology", "Email", "jane.sample@example.com", "TAX ID SUNRISE", 222334444],
  ["CAQH Logins", "janesample  FakePass1!", "Board Certification", "NO"],
  ["PECOS Logins", "JaneS  FakePass2!", "Phone Number", "917-555-0199"],
  ["DOB", "5/7/1972", "Gender", "Female"],
  ["Home address", "1 Test St Apt 2, New York, NY 10024", "Medicare & Medicaid", "000000ZMCC       &     0000001"],
  header,
  ["1199", "Panel Closed(10/01/2026)(Still closed,Confirmation by an Email)", null, null, "09/29/2025,We sent the application", "10/14/2025"],
  ["Aetna", "Participating", 7003502, "10/22/2025", "09/28/2025,Applied online and got ref# 55512", null, "Invoiced"],
  ["Cigna", "Participating", 2234475, "9/20/2025", "09/29/2025, We sent the RL", null, "Invoiced"],
  ["Medicaid Group", "Participating", 1160486, "9/26/2025", "09/28/2025, we sent the group application", null, "Invoiced"],
  ["Mediciad", "Participating", 185132, "9/26/2025", null, "01/21/2026", "Invoiced"],
  ["Medicare group", "Participating", "7X9029", "10/1/2025", "10/2/2025,submitted online", null, "Invoiced"],
  ["Medicare (ind)", "Participating", "8P6619", "10/1/2025", null, "02/26/2026", "Invoiced"],
  ["Humana", "Participating", 1154372621, "07/01/2026", "09/29/2025,We sent the RL", "01/08/2026"],
  ["Emblem GHI", "Panel Closed(Outside NY , Welcare and UMR replace Emblem )(10/01/2026)", null, null, "09/29/2025,We sent the RL"],
  ["BCBS Horizan", "Enrolled with this address with another group", null, null, null, "03/12/2026"],
  ["Multiplan(Group)", "in-process", null, null, "09/29/2025,apply online", "06/01/2026"],
  ["Multiplan(ind)", "starts after group credentialing"],
  ["WELLCARE/Fidelis Care", "Participating", 5073710, "04/01/2026.", "09/29/2025,Apply online", "01/08/2026"],
  ["Clover Health( Medicare Advantage PPO HMO)", "Participating", 1154372621, "11/01/2025", "09/29/2025,We sent the RL along with the W9", null, "Invoiced"],
  ["Aetna Better Health", "In process", null, null, "Credentialing packet was sent", "02/12/2026"],
  ["UHC", "Participating", 6364921, "07/30/2026.", "Request letter and W9 was sent", "Followup"],
  ["Ambetter", "Participating", 4236953, "04/01/2026"],
  ["Curative", "Participating", 1154372621, "9/9/2026", "Applied via Email(09/04/2026)"],
  [],
  [null, "Ambetter ID:"],
];

const sheet2 = [
  ["Riverside Family Practice"],
  ["Provider Name", "Alex Example", "SSN", "000-98-7654"],
  ["NPI", 1987654320, "CAQH ID", 11223344],
  ["Group NPI", 1987654301, "Phone Number", "718-555-0123"],
  ["Tax ID", 555667777, "DEA", "FE7654321 EXP 11/30/2026"],
  ["Speciality", "207Q00000X - Family Medicine", "State Licence", "NY-123456 EXP 12/31/2026"],
  header,
  ["Aetna", "In process", null, null, "10/01/2026, submitted via Availity", "10/20/2026"],
  ["Medicare group", "Participating", "9Q1111", "8/1/2026", null, null, "Invoiced"],
  ["Medicare", "Participating", "9Q2222", "8/1/2026"],
  ["UHC", "Not started"],
  [],
  ["Provider Name", "Sam Placeholder", "SSN", "000-55-4444"],
  ["NPI", 1555555550, "CAQH ID", 55443322],
  ["Speciality", "363LF0000X - Nurse Practitioner, Family", "State Licence", "NY-NP-7777 EXP 10/31/2026"],
  ["CAQH Logins", "samp  FakePass3!"],
  header,
  ["Aetna", "Participating", "AE-778", "9/1/2026", "08/15/2026 approved"],
  ["Medicare group", "Participating", "9Q1111", "8/1/2026"],
  ["Medicare", "in-process", null, null, "09/15/2026 855R submitted", "10/06/2026"],
  ["Oxford plans", "Denied", null, null, "09/30/2026 denied – network adequacy"],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), "Sunrise");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), "Riverside");
mkdirSync(".data/samples", { recursive: true });
XLSX.writeFile(wb, ".data/samples/sample-credentialing.xlsx");
console.log("Wrote .data/samples/sample-credentialing.xlsx");
