import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        message.type() === 'error' ||
        (message.type() === 'warning' && /react/i.test(message.text()))
      ) {
        errors.push(message.text());
      }
    });
    await use(page);
    expect(errors, 'Unexpected page errors').toEqual([]);
  }
});
export { expect };
