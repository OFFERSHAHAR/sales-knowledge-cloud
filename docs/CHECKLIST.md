# צ׳קליסט דרישות — מגיש עופר

מקור: PDF המטלה. 118 פריטי חובה מפורטים; 53/53 בדיקות עברו.


## א · בחירת Use Case

- [x] א-01 יש שם ברור לפרויקט — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02
- [x] א-02 הבעיה העסקית מוגדרת — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02
- [x] א-03 ברור מי המשתמשים — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02
- [x] א-04 ברור מה התהליך הידני כיום — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02
- [x] א-05 ברור למה AI מתאים כאן — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02
- [x] א-06 ברור מה הערך העסקי — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02
- [x] א-07 ברור מה ייחשב הצלחה — תועד ונבדק במסמך; מסמך הגשה §1; תסריט דמו; B02

## ב · אפיון תהליך קיים

- [x] ב-01 מיפוי התהליך הנוכחי — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות
- [x] ב-02 זיהוי מקום קלט משתמש — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות
- [x] ב-03 זיהוי נקודת החלטה — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות
- [x] ב-04 זיהוי הדאטה — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות
- [x] ב-05 זיהוי הפעולה — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות
- [x] ב-06 זיהוי הסיכון — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות
- [x] ב-07 זיהוי צוואר הבקבוק — תועד ונבדק במסמך; מסמך הגשה §1: תהליך קיים / טבלת נקודות

## ג · תכנון הפתרון

- [x] ג-01 תהליך AI חדש וברור — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04
- [x] ג-02 ברור מה AI עושה — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04
- [x] ג-03 ברור מה AI לא עושה — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04
- [x] ג-04 ברור מתי Human Review — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04
- [x] ג-05 ברור מתי fallback — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04
- [x] ג-06 ברור מה הפעולה הסופית — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04
- [x] ג-07 תרשים ארכיטקטורה — תועד ונבדק במסמך; מסמך הגשה §2; architecture.svg; T01–T10; B02–B04

## ד · ממשק משתמש

- [x] ד-01 ממשק משתמש בסיסי — מומש ונבדק; public/index.html + app.js + style.css; B01–B08
- [x] ד-02 הזנת מידע — מומש ונבדק; public/index.html + app.js + style.css; B01–B08
- [x] ד-03 הצגת תשובה וסטטוס — מומש ונבדק; public/index.html + app.js + style.css; B01–B08
- [x] ד-04 טיפול בשגיאות — מומש ונבדק; public/index.html + app.js + style.css; B01–B08
- [x] ד-05 חיווי טעינה — מומש ונבדק; public/index.html + app.js + style.css; B01–B08
- [x] ד-06 ממשק שימושי — מומש ונבדק; public/index.html + app.js + style.css; B01–B08

## ה · Workflow

- [x] ה-01 Webhook מקבל קלט — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02
- [x] ה-02 עיבוד נתונים — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02
- [x] ה-03 לוגיקה ותנאים — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02
- [x] ה-04 חיבור ל-AI — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02
- [x] ה-05 שמירת תוצאה — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02
- [x] ה-06 תגובה למשתמש — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02
- [x] ה-07 עבודה מקצה לקצה — מומש ונבדק; POST /api/webhook; מימוש מקביל ל-n8n; T23–T24; L01–L02; B02

## ו · AI Agent / LLM

- [x] ו-01 שימוש ב-Agent או LLM — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-02 System Prompt ברור — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-03 תפקיד Agent — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-04 מטרה — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-05 Context — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-06 Rules — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-07 Output Format — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-08 fallback — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27
- [x] ו-09 מגבלת אורך, סגנון ושפה — מומש ונבדק; system-prompt.txt; schema + validateModel; L01–L02; T26–T27

## ז · דאטה / Knowledge Base

- [x] ז-01 מקור דאטה ברור — מומש ונבדק; seed.json מסומן כנתוני דמו; KB מאושר; T02–T07; T25; T34; B03
- [x] ז-02 דאטה רלוונטי לבעיה — מומש ונבדק; seed.json מסומן כנתוני דמו; KB מאושר; T02–T07; T25; T34; B03
- [x] ז-03 אי שליחת מידע מיותר ל-AI — מומש ונבדק; seed.json מסומן כנתוני דמו; KB מאושר; T02–T07; T25; T34; B03
- [x] ז-04 אי שליחת secrets ומידע רגיש שאינו נחוץ — מומש ונבדק; seed.json מסומן כנתוני דמו; KB מאושר; T02–T07; T25; T34; B03
- [x] ז-05 שליפת מידע רלוונטי — מומש ונבדק; seed.json מסומן כנתוני דמו; KB מאושר; T02–T07; T25; T34; B03
- [x] ז-06 טיפול בהיעדר מידע — מומש ונבדק; seed.json מסומן כנתוני דמו; KB מאושר; T02–T07; T25; T34; B03

## ח · Automation / Tools / MCP

- [x] ח-01 המערכת מבצעת פעולה — מומש ונבדק; tool-contracts.json; tool allowlist; T01; T19; T24; T27
- [x] ח-02 פעולה מוגבלת וברורה — מומש ונבדק; tool-contracts.json; tool allowlist; T01; T19; T24; T27
- [x] ח-03 Tool Contract — מומש ונבדק; tool-contracts.json; tool allowlist; T01; T19; T24; T27
- [x] ח-04 מתי מפעילים כלי — מומש ונבדק; tool-contracts.json; tool allowlist; T01; T19; T24; T27
- [x] ח-05 פעולות אסורות לכלי — מומש ונבדק; tool-contracts.json; tool allowlist; T01; T19; T24; T27
- [x] ח-06 בדיקה נגד שימוש לא נכון — מומש ונבדק; tool-contracts.json; tool allowlist; T01; T19; T24; T27

## ט · Human-in-the-loop

- [x] ט-01 מתי AI פועל לבד — מומש ונבדק; מרכז אישורים ואבטחה; T05–T10; T14–T19; B04–B06
- [x] ט-02 מתי צריך אדם — מומש ונבדק; מרכז אישורים ואבטחה; T05–T10; T14–T19; B04–B06
- [x] ט-03 escalation path — מומש ונבדק; מרכז אישורים ואבטחה; T05–T10; T14–T19; B04–B06
- [x] ט-04 מצב Review — מומש ונבדק; מרכז אישורים ואבטחה; T05–T10; T14–T19; B04–B06
- [x] ט-05 מקרי סירוב — מומש ונבדק; מרכז אישורים ואבטחה; T05–T10; T14–T19; B04–B06
- [x] ט-06 לוג החלטות — מומש ונבדק; מרכז אישורים ואבטחה; T05–T10; T14–T19; B04–B06

## י · Guardrails

- [x] י-01 fallback — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-02 מניעת hallucination — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-03 הגבלת תשובה — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-04 שאלה ללא מידע — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-05 Prompt Injection — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-06 הפרדת input מהוראות system — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-07 אי חשיפת prompt פנימי — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד
- [x] י-08 אי חשיפת לוגים או מידע פנימי — מומש ונבדק; Extractive quotes + JSON schema + מקור מדויק; T14; T25–T27; T31; System Prompt בשרת בלבד

## יא · Security / Zero Trust

- [x] יא-01 אין API keys בקוד — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-02 אין secrets ב-frontend — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-03 validation לקלט — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-04 הגבלת אורך קלט — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-05 אי שימוש ב-innerHTML עם קלט משתמש — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-06 הרשאות מינימליות לכל tool — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-07 אין Agent עם הרשאות מיותרות — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-08 לוגים לפעולות משמעותיות — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md
- [x] יא-09 חשיבה על Webhook URL חשוף — מומש ונבדק; T11–T13; T19–T24; T28–T29; T34; gateway HMAC; security-report.md

## יב · Evaluation / Testing

- [x] יב-01 לפחות 10–15 בדיקות — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-02 Expected Result — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-03 Actual Result — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-04 Pass / Fail — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-05 Error Type — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-06 בדיקת Prompt Injection — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-07 בדיקת fallback — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-08 בדיקת tool misuse — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח
- [x] יב-09 בדיקת input לא תקין — מומש ונבדק; test-results.json + live-test-results.json + browser-test-results.json; טבלת הבדיקות בנספח

## יג · Observability / Logs / Dashboard

- [x] יג-01 כל הרצה נשמרת בלוג — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-02 runId או timestamp — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-03 סטטוס הרצה — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-04 האם היה fallback — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-05 האם היה Human Review — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-06 האם הופעל Tool — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-07 errorType — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png
- [x] יג-08 Dashboard בסיסי — מומש ונבדק; runs/events/audit; T29–T30; T33; B06; screenshots/dashboard.png

## יד · Production Rollout

- [x] יד-01 הסבר עלייה לפיילוט — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production
- [x] יד-02 owner עסקי — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production
- [x] יד-03 owner טכני — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production
- [x] יד-04 סיכונים ובקרות — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production
- [x] יד-05 תנאי Go / No-Go — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production
- [x] יד-06 מדדי הצלחה — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production
- [x] יד-07 שיפור עתידי — תועד ונבדק במסמך; מסמך הגשה §4; תוכנית מתועדת ולא טענה שהמערכת מוסמכת ל-Production

## 9 · Sales Call Follow-up Assistant

- [x] 9-01 טקסט חופשי מהשיחה — מומש ונבדק; T01; T09–T10; L01–L02; B02–B04; שליחה מוגבלת לייצוא טיוטה מאושרת
- [x] 9-02 סיכום — מומש ונבדק; T01; T09–T10; L01–L02; B02–B04; שליחה מוגבלת לייצוא טיוטה מאושרת
- [x] 9-03 זיהוי next steps — מומש ונבדק; T01; T09–T10; L01–L02; B02–B04; שליחה מוגבלת לייצוא טיוטה מאושרת
- [x] 9-04 יצירת משימה — מומש ונבדק; T01; T09–T10; L01–L02; B02–B04; שליחה מוגבלת לייצוא טיוטה מאושרת
- [x] 9-05 ניסוח מייל טיוטה — מומש ונבדק; T01; T09–T10; L01–L02; B02–B04; שליחה מוגבלת לייצוא טיוטה מאושרת
- [x] 9-06 אישור אדם לפני שליחה — מומש ונבדק; T01; T09–T10; L01–L02; B02–B04; שליחה מוגבלת לייצוא טיוטה מאושרת

## 10 · Knowledge Base Improvement System

- [x] 10-01 fallback detection — מומש ונבדק; T02–T07; T30; B03; topic grouping + count-based priority
- [x] 10-02 ticket creation — מומש ונבדק; T02–T07; T30; B03; topic grouping + count-based priority
- [x] 10-03 topic clustering — מומש ונבדק; T02–T07; T30; B03; topic grouping + count-based priority
- [x] 10-04 priority — מומש ונבדק; T02–T07; T30; B03; topic grouping + count-based priority
- [x] 10-05 dashboard missing knowledge — מומש ונבדק; T02–T07; T30; B03; topic grouping + count-based priority
- [x] 10-06 human approval לעדכון KB — מומש ונבדק; T02–T07; T30; B03; topic grouping + count-based priority

## S · תוצרים להגשה

- [x] S-01 דמו עובד Input → Workflow → AI → Decision/Action → Log → Output — תועד ונבדק במסמך; מסמך הגשה, נספח אימות, DEMO.md, קוד ולינק חי
- [x] S-02 מסמך קצר עם 12 הנושאים הנדרשים — תועד ונבדק במסמך; מסמך הגשה, נספח אימות, DEMO.md, קוד ולינק חי
- [x] S-03 הצגה קצרה עם 9 הנושאים הנדרשים — תועד ונבדק במסמך; מסמך הגשה, נספח אימות, DEMO.md, קוד ולינק חי
- [x] S-04 טבלת בדיקות כולל Fix Needed — תועד ונבדק במסמך; מסמך הגשה, נספח אימות, DEMO.md, קוד ולינק חי

## הרחבות ובקרות Production

- [x] AES-256-GCM לנתונים רגישים, פלטי AI, ידע וצילומים — מומש ונבדק; T28; T32; B05
- [x] מניעת SQL injection באמצעות prepared statements + חסימת תבניות — מומש ונבדק; T18; server.mjs
- [x] הסגר חשבון מזוהה + ביטול סשנים — מומש ונבדק; T14–T15; B05
- [x] שיוך התראה והסלמה היררכית — מומש ונבדק; T16–T17; B05; מרכז התראות פנימי
- [x] צילום חלון האפליקציה ושמירת ראיה מוצפנת — מומש ונבדק; T32; B05; צילום תלוי בדפדפן ואינו צילום מחשב המשתמש
- [x] לוגים מלאים לפי שלבים + HMAC integrity + ייצוא — מומש ונבדק; T29; T33; B06
- [x] לינק Vercel חי + AI + שמירה ואישורים מקצה לקצה — מומש ונבדק; B01–B08; HTTPS; גשר פרטי פעיל
- [ ] התראות חיצוניות לכתובות ארגוניות — ממתין להגדרת יעדים; לא נמסרו כתובות; התראות פנימיות עובדות
- [ ] SSO/MFA וזהויות ארגוניות אישיות — מתוכנן ל-Production; בדמו שני חשבונות מבודדים; אין חיבור IdP
- [ ] KMS/HSM, WORM, בדיקת חדירה ותשתית זמינה תמיד — מתוכנן ל-Production; תוכנית rollout וסיכונים; לא הוצגה הסמכה או הבטחת מניעת כל תקיפה