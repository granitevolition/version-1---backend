const QueueService = require('./utils/queueService');
const db = require('./db');
const { initializeTables } = require('./db/migration');

// Configuration
const POLLING_INTERVAL = process.env.QUEUE_POLLING_INTERVAL || 5000; // 5 seconds by default
const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).substring(2, 10)}`;
const MAX_CONSECUTIVE_ERRORS = 10;

let running = true;
let consecutiveErrors = 0;

/**
 * Process the queue in a loop
 */
async function processQueue() {
  console.log(`[WORKER ${WORKER_ID}] Starting queue processing...`);
  
  while (running) {
    try {
      // Process one item from the queue
      const processed = await QueueService.processNextItem();
      
      if (processed) {
        // Reset error counter on success
        consecutiveErrors = 0;
        // Continue immediately if we processed an item (no wait)
        continue;
      } else {
        // If no items were processed, wait before checking again
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      }
    } catch (error) {
      consecutiveErrors++;
      console.error(`[WORKER ${WORKER_ID}] Error processing queue:`, error);
      
      // If we've had too many consecutive errors, pause longer
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`[WORKER ${WORKER_ID}] Too many consecutive errors, pausing for recovery...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * 5));
        consecutiveErrors = Math.floor(MAX_CONSECUTIVE_ERRORS / 2); // Reduce the counter to allow recovery
      } else {
        // Normal error, wait the standard interval
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      }
    }
  }
  
  console.log(`[WORKER ${WORKER_ID}] Queue processing stopped.`);
}

/**
 * Initialize the worker
 */
async function initializeWorker() {
  try {
    // Connect to database
    await initializeTables();
    
    console.log(`[WORKER ${WORKER_ID}] Successfully connected to database`);
    console.log(`[WORKER ${WORKER_ID}] Polling interval: ${POLLING_INTERVAL}ms`);
    
    // Start processing the queue
    await processQueue();
  } catch (error) {
    console.error(`[WORKER ${WORKER_ID}] Initialization error:`, error);
    process.exit(1);
  }
}

/**
 * Handle shutdown signals
 */
function handleShutdown() {
  console.log(`[WORKER ${WORKER_ID}] Shutting down gracefully...`);
  running = false;
  
  // Give the worker a chance to complete the current task
  setTimeout(() => {
    console.log(`[WORKER ${WORKER_ID}] Shutdown complete.`);
    process.exit(0);
  }, 5000);
}

// Listen for shutdown signals
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Start the worker
initializeWorker().catch(error => {
  console.error(`[WORKER ${WORKER_ID}] Fatal error:`, error);
  process.exit(1);
});
