// Flieger-Profile für Hersteller und Entwickler. Wird beim Start in die config.json eingetragen, falls sie fehlen.
'use strict';
const PROFILES = [
 {
  "id": "inibuilds-a330",
  "name": "A330-200/-300/P2F",
  "maker": "Airbus",
  "dev": "iniBuilds",
  "match": [
   "iniBuilds&A330"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "A333"
 },
 {
  "id": "msfs-a330",
  "name": "A330-200/-300/P2F",
  "maker": "Airbus",
  "dev": "Standard / andere",
  "match": [
   "A330"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "A333"
 },
 {
  "id": "inibuilds-a350",
  "name": "A350",
  "maker": "Airbus",
  "dev": "iniBuilds",
  "match": [
   "A350",
   "A35K"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "A359"
 },
 {
  "id": "inibuilds-a340",
  "name": "A340",
  "maker": "Airbus",
  "dev": "iniBuilds",
  "match": [
   "A340"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std4",
  "perf": "A346"
 },
 {
  "id": "inibuilds-a310",
  "name": "A310",
  "maker": "Airbus",
  "dev": "iniBuilds",
  "match": [
   "A310"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "A310"
 },
 {
  "id": "inibuilds-a300",
  "name": "A300-600",
  "maker": "Airbus",
  "dev": "iniBuilds",
  "match": [
   "A300"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "A306"
 },
 {
  "id": "msfs-a400m",
  "name": "A400M",
  "maker": "Airbus",
  "dev": "Standard / andere",
  "match": [
   "A400"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-wide",
  "notes": "",
  "remote": "msfs-std4",
  "perf": "A400"
 },
 {
  "id": "msfs-a320",
  "name": "A320neo",
  "maker": "Airbus",
  "dev": "Standard (MSFS)",
  "match": [
   "A320"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "airbus-narrow",
  "notes": "",
  "remote": "msfs-std",
  "perf": "A320"
 },
 {
  "id": "pmdg-737",
  "name": "737-600/700/800/900",
  "maker": "Boeing",
  "dev": "PMDG",
  "match": [
   "PMDG&737"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-narrow",
  "notes": "",
  "remote": "msfs-std",
  "perf": "B738"
 },
 {
  "id": "pmdg-777",
  "name": "777-200ER/300ER/F",
  "maker": "Boeing",
  "dev": "PMDG",
  "match": [
   "PMDG&777"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "B77W"
 },
 {
  "id": "boeing-737max",
  "name": "737 MAX",
  "maker": "Boeing",
  "dev": "Standard / andere",
  "match": [
   "737 MAX",
   "737-8",
   "737MAX"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-narrow",
  "notes": "",
  "remote": "msfs-std",
  "perf": "B38M"
 },
 {
  "id": "boeing-737",
  "name": "737-800",
  "maker": "Boeing",
  "dev": "Standard (MSFS)",
  "match": [
   "737"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-narrow",
  "notes": "",
  "remote": "msfs-std",
  "perf": "B738"
 },
 {
  "id": "boeing-747",
  "name": "747-8",
  "maker": "Boeing",
  "dev": "Standard (MSFS)",
  "match": [
   "747"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-wide",
  "notes": "",
  "remote": "msfs-std4",
  "perf": "B748"
 },
 {
  "id": "boeing-777",
  "name": "777",
  "maker": "Boeing",
  "dev": "Standard / andere",
  "match": [
   "777"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "B77W"
 },
 {
  "id": "boeing-787",
  "name": "787-10",
  "maker": "Boeing",
  "dev": "Standard (MSFS)",
  "match": [
   "787"
  ],
  "efbUrl": "",
  "mcduUrl": "",
  "checklist": "boeing-wide",
  "notes": "",
  "remote": "msfs-std",
  "perf": "B789"
 }
];
module.exports = { PROFILES };
