/**
 * Deprecated Puppeteer Service
 * This file is a placeholder for the removed puppeteer service
 */

// This service has been deprecated and intentionally provides no functionality
const createBrowser = async () => {
  throw new Error('PuppeteerService has been deprecated');
};

const closeBrowser = async () => {
  // No-op function
  return;
};

module.exports = {
  createBrowser,
  closeBrowser
};
