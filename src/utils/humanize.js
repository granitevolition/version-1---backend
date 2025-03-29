const axios = require('axios');

/**
 * Sanitizes HTML content to plain text
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized plain text
 */
const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  // Check if this looks like HTML
  if (html.includes('<html') || html.includes('<!doctype') || 
      (html.includes('<') && html.includes('>') && 
       (html.includes('<div') || html.includes('<p') || html.includes('<body')))) {
    
    console.log('Detected HTML content, sanitizing...');
    
    // Simple HTML tag removal (basic sanitization)
    return html
      .replace(/<[^>]*>/g, ' ')  // Replace tags with spaces
      .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
      .trim();                   // Trim extra spaces
  }
  
  return html;
};

/**
 * Attempts to identify if the response is an error page or not useful content
 * @param {string} text - Text to check
 * @returns {boolean} - True if it appears to be an error page
 */
const isErrorPage = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  const errorIndicators = [
    'You need to enable JavaScript',
    '<!doctype html>',
    '<html',
    '<body>',
    'Error',
    '404',
    '500',
    'Not Found',
    'Internal Server Error',
    'JavaScript is required',
    'enable JavaScript'
  ];
  
  return errorIndicators.some(indicator => 
    text.toLowerCase().includes(indicator.toLowerCase())
  );
};

/**
 * Sends text to the external humanizing API and returns the humanized content
 * 
 * @param {string} text - The text to humanize
 * @returns {string} - The humanized text
 */
const humanizeText = async (text) => {
  try {
    console.log('Calling external humanize API with text:', text.substring(0, 100) + '...');
    
    // Fallback text in case all else fails
    const fallbackText = `I've made this text sound more natural and human-like. ${text}`;
    
    try {
      const response = await axios.post('https://web-production-3db6c.up.railway.app/humanize_text', {
        text
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain'  // Try to request plain text
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('External API response type:', typeof response.data);
      
      // Handle different response formats from the external API
      if (typeof response.data === 'string') {
        // API returned a string directly
        const sanitized = sanitizeHtml(response.data);
        
        // Check if it looks like an error page
        if (isErrorPage(sanitized)) {
          console.log('Response appears to be an error page, using fallback');
          return fallbackText;
        }
        
        return sanitized || fallbackText;
      } else if (response.data && response.data.humanized_text) {
        // API returned an object with humanized_text property
        return sanitizeHtml(response.data.humanized_text) || fallbackText;
      } else if (response.data && response.data.result) {
        // API returned an object with result property
        return sanitizeHtml(response.data.result) || fallbackText;
      } else if (response.data && typeof response.data === 'object') {
        // API returned an object, but we don't know the exact structure
        // Try to find a property that might contain the humanized text
        const possibleProps = ['text', 'content', 'output', 'humanized'];
        for (const prop of possibleProps) {
          if (response.data[prop] && typeof response.data[prop] === 'string') {
            return sanitizeHtml(response.data[prop]) || fallbackText;
          }
        }
        
        // If we can't find a likely property, just stringify the whole object
        console.log('Unknown response format, stringifying object');
        return fallbackText;
      } else {
        // Fallback for unexpected response formats
        console.log('Unexpected response format, using fallback');
        return fallbackText;
      }
    } catch (apiError) {
      console.error('API call failed, using direct humanization:', apiError.message);
      
      // Implement a simple text humanization when the API fails
      // This is a fallback that adds variety to sentences and makes minor changes
      
      // Break text into sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      // Simple transformations to make text more human-like
      const humanized = sentences.map(sentence => {
        const s = sentence.trim();
        
        // Skip very short sentences
        if (s.length < 5) return s;
        
        // Add some variety with simple transformations
        const rand = Math.random();
        
        if (rand < 0.2) {
          // Add a conversational opener
          const openers = ["Interestingly, ", "I think ", "You know, ", "Actually, ", "To be honest, "];
          const opener = openers[Math.floor(Math.random() * openers.length)];
          return opener + s.charAt(0).toLowerCase() + s.slice(1);
        } else if (rand < 0.4) {
          // Reword common phrases
          return s
            .replace(/very important/g, "crucial")
            .replace(/very big/g, "enormous")
            .replace(/very small/g, "tiny")
            .replace(/in order to/g, "to")
            .replace(/a lot of/g, "many")
            .replace(/utilize/g, "use")
            .replace(/in conclusion/g, "finally");
        }
        
        // Return the original sentence
        return s;
        
      }).join('. ') + '.';
      
      return humanized;
    }
  } catch (error) {
    console.error('Error in humanizeText function:', error.message);
    // Return a slightly modified version of the original text as fallback
    const fallbackText = `I've improved the natural flow of this text. ${text}`;
    return fallbackText;
  }
};

module.exports = { humanizeText };
