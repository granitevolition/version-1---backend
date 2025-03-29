# Puppeteer Integration Guide

This guide outlines how to implement the Enhanced Puppeteer Solution to solve backend-API communication issues.

## Why Puppeteer?

Puppeteer provides a way to make API requests that appear to come from a real browser, bypassing many of the restrictions that APIs put on server-to-server communication.

## Integration Steps

1. Add dependencies to your backend:
   ```bash
   npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth winston
   ```

2. Create the necessary directory structure:
   ```
   services/
     - puppeteerService.js
     - apiClient.js
   controllers/
     - apiController.js
   routes/
     - api.js
   debug/  # For error screenshots
   ```

3. Copy the implementation files from the reference repository:
   https://github.com/granitevolition/puppeteer-solution-implementation

4. Configure environment variables:
   - `API_BASE_URL`: The base URL of the API you're connecting to
   - `FRONTEND_URL`: URL of your frontend (for CORS)
   - `NODE_ENV`: Set to "production" for deployment

5. Update your Dockerfile to include Chrome:
   ```Dockerfile
   # Install latest Chrome and dependencies
   RUN apt-get update \
       && apt-get install -y wget gnupg \
       && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
       && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
       && apt-get update \
       && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
         --no-install-recommends \
       && rm -rf /var/lib/apt/lists/*
       
   # Set Puppeteer environment variables
   ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
   ```

6. Mount the API routes in your Express app:
   ```javascript
   const apiRoutes = require('./routes/api');
   app.use('/api', apiRoutes);
   ```

## Testing Your Implementation

1. Check the health endpoint:
   ```
   GET /api/health
   ```

2. Test a specific API endpoint through your backend:
   ```
   GET /api/your-endpoint
   ```

3. Check for error screenshots in the `debug` directory if you encounter issues.