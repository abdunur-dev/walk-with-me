# Testing notes

Record every manual test here, with the co-designer's permission. Do not write results that did not happen.

## Main task
"You are on this lesson page. 1) Find out where to finish the lesson. 2) Ask a question about the lesson. 3) You are stuck, so ask for a person. 4) Set up a job alert for customer support in Addis Ababa."

| Date / time | Tester | Device and OS | Browser | Assistive technology | Step reached | Time | Where they hesitated | Result |
|---|---|---|---|---|---|---|---|---|
| | | | | NVDA | | | | |
| | | | | TalkBack | | | | |
| | | | | Keyboard only | | | | |
| | | | | 200% zoom | | | | |
| | | | | Sound off | | | | |

## Hour-one checks
- [ ] Does `am-ET` speech recognition work on the co-designer's phone?
- [ ] Is there an Amharic `speechSynthesis` voice on that phone?
- [ ] Real Savanna selectors copied into `widget/actions.js`
- [ ] SMS provider answer from a mentor

## Other manual checks
| Check | Result | Notes |
|---|---|---|
| Text spacing override (bookmarklet) | | |
| `dir="rtl"` on `<html>` | | |
| 320 px / 400% zoom | | |
| Slow 3G: time to first answer | | |
| Network off: offline answer | | |
| Clean clone: `docker compose up` | | |
