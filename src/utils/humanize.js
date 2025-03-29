const axios = require('axios');

/**
 * Locally humanizes text without relying on external API
 * @param {string} text - Text to humanize
 * @returns {string} - Humanized text
 */
function localHumanize(text) {
  if (!text || typeof text !== 'string') {
    return "I've improved this text to sound more natural and human-like.";
  }

  console.log('Using local humanization fallback mechanism');

  // Break text into sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return text;

  // Transformations to make text more conversational and varied
  const transformedSentences = sentences.map((sentence, index) => {
    // Skip very short sentences or keep first sentence as-is
    if (sentence.length < 10 || index === 0) return sentence;

    // Randomly apply different transformations
    const rand = Math.random();

    // 30% chance to add a conversational opener
    if (rand < 0.3) {
      const openers = [
        "Interestingly, ", 
        "In fact, ", 
        "You know, ", 
        "Actually, ", 
        "To be honest, ", 
        "Remarkably, ", 
        "Surprisingly, ",
        "Notably, ",
        "I should mention that ",
        "It's worth noting that "
      ];
      const opener = openers[Math.floor(Math.random() * openers.length)];
      // Make sure the first letter is lowercase after the opener
      return opener + sentence.charAt(0).toLowerCase() + sentence.slice(1);
    } 
    // 20% chance to add a mid-sentence bridge word
    else if (rand < 0.5 && sentence.length > 20) {
      const bridges = [
        ", essentially, ",
        ", basically, ",
        ", in a way, ",
        ", more or less, ",
        ", you might say, ",
        ", generally speaking, ",
        ", somewhat surprisingly, "
      ];
      
      const bridge = bridges[Math.floor(Math.random() * bridges.length)];
      const midpoint = Math.floor(sentence.length / 2);
      let splitPoint = sentence.indexOf(' ', midpoint);
      if (splitPoint === -1) splitPoint = midpoint;
      
      return sentence.slice(0, splitPoint) + bridge + sentence.slice(splitPoint);
    } 
    // 15% chance to reword common AI phrases
    else if (rand < 0.65) {
      return sentence
        .replace(/it is important/gi, "it's crucial")
        .replace(/very important/gi, "essential")
        .replace(/very interesting/gi, "fascinating")
        .replace(/very big/gi, "enormous")
        .replace(/very small/gi, "tiny")
        .replace(/in order to/gi, "to")
        .replace(/a lot of/gi, "many")
        .replace(/utilize/gi, "use")
        .replace(/in conclusion/gi, "finally")
        .replace(/for example/gi, "for instance")
        .replace(/in my opinion/gi, "I think")
        .replace(/nevertheless/gi, "even so")
        .replace(/subsequently/gi, "later")
        .replace(/furthermore/gi, "also")
        .replace(/in addition/gi, "plus")
        .replace(/therefore/gi, "so")
        .replace(/consequently/gi, "as a result")
        .replace(/despite the fact that/gi, "although");
    }
    
    // Otherwise, keep the original sentence
    return sentence;
  });

  // 50% chance to reorganize one sentence if text is long enough
  if (transformedSentences.length > 3 && Math.random() > 0.5) {
    const i = Math.floor(Math.random() * (transformedSentences.length - 2)) + 1;
    // Swap two sentences
    [transformedSentences[i], transformedSentences[i+1]] = 
    [transformedSentences[i+1], transformedSentences[i]];
  }

  // Add contractions to make text seem more casual
  let result = transformedSentences.join(' ')
    .replace(/it is/g, "it's")
    .replace(/that is/g, "that's")
    .replace(/there is/g, "there's")
    .replace(/he is/g, "he's")
    .replace(/she is/g, "she's")
    .replace(/they are/g, "they're")
    .replace(/we are/g, "we're")
    .replace(/you are/g, "you're")
    .replace(/do not/g, "don't")
    .replace(/does not/g, "doesn't")
    .replace(/did not/g, "didn't")
    .replace(/has not/g, "hasn't")
    .replace(/have not/g, "haven't")
    .replace(/would not/g, "wouldn't")
    .replace(/could not/g, "couldn't")
    .replace(/should not/g, "shouldn't")
    .replace(/will not/g, "won't")
    .replace(/I would/g, "I'd")
    .replace(/they would/g, "they'd")
    .replace(/we would/g, "we'd")
    .replace(/you would/g, "you'd")
    .replace(/I will/g, "I'll")
    .replace(/they will/g, "they'll")
    .replace(/we will/g, "we'll")
    .replace(/you will/g, "you'll");
  
  // 20% chance to add a personal reflection at the end for longer texts
  if (result.length > 200 && Math.random() < 0.2) {
    const reflections = [
      " I find this story quite captivating.",
      " This reminds me of classic adventure tales.",
      " What a wonderful narrative.",
      " This is the kind of story that stays with you.",
      " I can almost picture the scenes described here."
    ];
    result += reflections[Math.floor(Math.random() * reflections.length)];
  }
  
  return result;
}

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
    'enable JavaScript',
    'User Registration'
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
    
    // First check - if text is very short, just humanize locally
    if (text.length < 100) {
      console.log('Text is short, using local humanization');
      return localHumanize(text);
    }
    
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
          console.log('Response appears to be an error page, using local humanization');
          return localHumanize(text);
        }
        
        return sanitized || localHumanize(text);
      } else if (response.data && response.data.humanized_text) {
        // API returned an object with humanized_text property
        return sanitizeHtml(response.data.humanized_text) || localHumanize(text);
      } else if (response.data && response.data.result) {
        // API returned an object with result property
        return sanitizeHtml(response.data.result) || localHumanize(text);
      } else if (response.data && typeof response.data === 'object') {
        // API returned an object, but we don't know the exact structure
        // Try to find a property that might contain the humanized text
        const possibleProps = ['text', 'content', 'output', 'humanized'];
        for (const prop of possibleProps) {
          if (response.data[prop] && typeof response.data[prop] === 'string') {
            return sanitizeHtml(response.data[prop]) || localHumanize(text);
          }
        }
        
        // If we can't find a likely property, use local humanization
        console.log('Unknown response format, using local humanization');
        return localHumanize(text);
      } else {
        // Fallback for unexpected response formats
        console.log('Unexpected response format, using local humanization');
        return localHumanize(text);
      }
    } catch (apiError) {
      console.error('API call failed, using local humanization:', apiError.message);
      return localHumanize(text);
    }
  } catch (error) {
    console.error('Error in humanizeText function:', error.message);
    // Use local humanization as final fallback
    return localHumanize(text);
  }
};

module.exports = { humanizeText };
