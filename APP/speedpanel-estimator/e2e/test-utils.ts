import { expect } from "@playwright/test";

export async function expectTextVisibleWithSnapshot(page: import('@playwright/test').Page, textOrRegex: string | RegExp, timeout = 20_000) {
  try {
    await expect(page.getByText(textOrRegex)).toBeVisible({ timeout });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`--- PAGE HTML SNAPSHOT (for '${String(textOrRegex)}') ---`);
    // eslint-disable-next-line no-console
    console.log(await page.content());
    throw err;
  }
}
