# inkpost

A gift: a picture frame with a Waveshare 7.5" e-paper display driven by an ESP32. The frame connects to Wi-Fi and fetches what to show from an API, so the owner can change the displayed content remotely throughout the day and it always shows something new.

## Structure

- `inkpost-firmware/`: ESP-IDF firmware for the ESP32 that drives the e-paper display and fetches content from the API.
- `inkpost-api/`: the API that decides and serves what the frame displays.

## Design decisions

All design decisions are recorded in `docs/DECISIONS.md`. Read it before making changes, and add new decisions there.
