/* Optional: mirror every lead into a Google Sheet.
   1. Open your Sheet → Extensions → Apps Script → paste this → Save.
   2. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone → Deploy.
   3. Copy the Web app URL and set it as the Worker secret SHEET_WEBHOOK_URL. */
const COLS = ['created_at_ist','project_code','project_name','name','full_phone','email','config','form_source',
  'utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','landing_url','city','country','is_duplicate','otp_verified','id'];
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.getActive().getSheetByName('Leads') || SpreadsheetApp.getActive().insertSheet('Leads');
  if (sh.getLastRow() === 0) sh.appendRow(COLS);
  sh.appendRow(COLS.map(c => d[c] == null ? '' : d[c]));
  return ContentService.createTextOutput('{"ok":true}').setMimeType(ContentService.MimeType.JSON);
}
