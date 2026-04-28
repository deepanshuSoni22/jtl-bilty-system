# JTL — Bilty Generator

A lightweight web app to generate transport billing documents (bilty PDFs) for **Jatin Trans Logistics**.

## Features

- **Quick form entry** — Bill info, party details, consignment details
- **Dynamic charges** — Add up to 8 charge line items with running total
- **Tax support** — CGST, SGST, IGST toggle
- **Google integration** — Forms sent to Apps Script, PDFs saved to Drive
- **Real-time polling** — Track document generation progress

## Setup

1. Deploy an Apps Script Web App with a handler for the form data
2. Open `index.html` in your browser
3. Paste the Apps Script Web App URL into the setup banner (one-time)
4. Fill the form and submit to generate your bilty PDF

## Files

- `index.html` — Main form UI
- `styles.css` — Styling (Bootstrap + custom)
- `app.js` — Client-side logic (form handling, polling, validation)
- `README.md` — This file

## Notes

- Requires Apps Script deployed as "Anyone can access"
- Bill numbers and document storage handled by backend
- Fully responsive (mobile-friendly)