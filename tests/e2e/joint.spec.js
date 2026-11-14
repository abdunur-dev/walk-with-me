// End-to-end: learner widget <-> staff console over the real API (WebSocket path). Needs the API on BASE_URL.
const { test, expect } = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://localhost:8000';

test('learner asks for a person, staff claims, chat both ways, snapshot, resolve', async ({ browser }) => {
  const learner = await (await browser.newContext()).newPage();
  await learner.goto(BASE + '/savanna/pages/concept-with-navigation.html');
  await learner.getByRole('button', { name: /^Help/ }).click();
  await learner.getByRole('button', { name: 'English' }).click();
  await learner.getByRole('button', { name: 'Normal' }).click();
  const box = learner.getByRole('textbox').first();
  await box.fill('where do I finish this lesson?');
  await box.press('Enter');
  await expect(learner.getByText('From: Finishing this lesson').first()).toBeVisible();

  await learner.getByRole('button', { name: 'Talk to a person' }).first().click();
  await learner.getByRole('button', { name: 'Chat', exact: true }).click();
  await learner.getByRole('button', { name: 'Send to a person' }).click();

  const staff = await (await browser.newContext()).newPage();
  await staff.goto(BASE + '/site/staff.html');
  await staff.locator('#token').fill('devtoken');
  await staff.getByRole('button', { name: 'Open the console' }).click();
  await staff.locator('#queue').getByRole('button').or(staff.locator('#queue a')).first().click();
  await staff.locator('#claim').click();
  await expect(learner.getByText(/Connected to a person|joined the chat/).first()).toBeVisible({ timeout: 15000 });

  await staff.locator('#msg').fill('Hello, I can help you.');
  await staff.locator('#send-form').getByRole('button', { name: 'Send' }).click();
  await expect(learner.getByText('Hello, I can help you.')).toBeVisible({ timeout: 10000 });

  await box.fill('Thank you, I cannot find the button');
  await box.press('Enter');
  await expect(staff.locator('#chat').getByText('Thank you, I cannot find the button')).toBeVisible({ timeout: 10000 });

  await staff.locator('#ask-share').click();
  await learner.getByRole('button', { name: /Share page view/ }).click();
  await expect(staff.locator('#snap')).toBeVisible({ timeout: 10000 });
  expect(await staff.locator('#snap').getAttribute('sandbox')).toBe('');

  await staff.locator('#resolve-form').getByRole('button', { name: 'Resolve' }).click();
  await expect(learner.getByText('Was this helpful?').first()).toBeVisible({ timeout: 10000 });
});
