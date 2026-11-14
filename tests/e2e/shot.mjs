import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'msedge' });
for (const [w, name] of [[1280,'desk'],[390,'mob']]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('http://localhost:8000/site/', { waitUntil: 'networkidle' });
  await p.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/claude/5d6096a35e425d74/2f976403-cab6-4d82-8d8f-fb098cc0aacb/scratchpad/home-' + name + '.png', fullPage: true });
}
await b.close();
