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

  // Break text into sentences - this pattern preserves the punctuation
  const sentencePattern = /([^.!?]+[.!?]+)/g;
  const sentences = text.match(sentencePattern) || [text];
  
  if (sentences.length === 0) return text;

  // Track which sentences we've modified to ensure we make changes
  const modifiedIndices = new Set();
  let modifiedCount = 0;
  const targetModifications = Math.max(2, Math.ceil(sentences.length * 0.6)); // Modify at least 60% of sentences

  // Copy of the sentences array for modification
  let resultSentences = [...sentences];

  // First pass: Apply more aggressive transformations to specific sentences
  for (let i = 0; i < sentences.length && modifiedCount < targetModifications; i++) {
    const sentence = sentences[i].trim();
    
    // Skip very short sentences
    if (sentence.length < 10) continue;
    
    // Apply a transformation based on sentence position
    let transformed = false;
    
    if (i === 0) {
      // First sentence transformations
      const firstSentenceStarters = [
        "Picture this: ",
        "Imagine a world where ",
        "Let me tell you about ",
        "Here's something captivating: ",
        "I love stories like this - ",
      ];
      const starter = firstSentenceStarters[Math.floor(Math.random() * firstSentenceStarters.length)];
      resultSentences[i] = starter + sentence.charAt(0).toLowerCase() + sentence.slice(1);
      transformed = true;
    } 
    else if (i === sentences.length - 1) {
      // Last sentence transformations
      const conclusionPhrases = [
        sentence + " Quite a fascinating tale, isn't it?",
        sentence + " This is the kind of story that really sticks with you.",
        sentence + " Stories like this remind me why I love imagination.",
        sentence + " What a wonderful journey through imagination."
      ];
      resultSentences[i] = conclusionPhrases[Math.floor(Math.random() * conclusionPhrases.length)];
      transformed = true;
    }
    else if (i < sentences.length / 2 && i % 2 === 0) {
      // Add conversational opener to some early sentences
      const openers = [
        "Interestingly, ", 
        "You know what's cool? ",
        "I find it fascinating that ",
        "It's amazing how ",
        "What strikes me is that ",
      ];
      const opener = openers[Math.floor(Math.random() * openers.length)];
      resultSentences[i] = opener + sentence.charAt(0).toLowerCase() + sentence.slice(1);
      transformed = true;
    } 
    else if (i >= sentences.length / 2 && sentence.length > 30) {
      // Add a mid-sentence bridge word to some later, longer sentences
      const bridges = [
        ", interestingly enough, ",
        ", and this is the best part, ",
        " - and I love this - ",
        ", which is really fascinating, ",
        ", and you can imagine, "
      ];
      
      const bridge = bridges[Math.floor(Math.random() * bridges.length)];
      const midpoint = Math.floor(sentence.length / 2);
      let splitPoint = sentence.indexOf(' ', midpoint);
      if (splitPoint === -1) splitPoint = midpoint;
      
      resultSentences[i] = sentence.slice(0, splitPoint) + bridge + sentence.slice(splitPoint);
      transformed = true;
    }
    
    if (transformed) {
      modifiedIndices.add(i);
      modifiedCount++;
    }
  }

  // Second pass: Do more general transformations for sentences we haven't modified yet
  for (let i = 0; i < sentences.length && modifiedCount < targetModifications; i++) {
    // Skip already modified sentences
    if (modifiedIndices.has(i)) continue;
    
    const sentence = sentences[i].trim();
    
    // Skip very short sentences
    if (sentence.length < 10) continue;
    
    // Apply word replacement transformations
    const replacements = [
      [/very important/gi, "crucial"],
      [/very interesting/gi, "fascinating"],
      [/very big/gi, "enormous"],
      [/very small/gi, "tiny"],
      [/in order to/gi, "to"],
      [/a lot of/gi, "many"],
      [/utilize/gi, "use"],
      [/in conclusion/gi, "finally"],
      [/for example/gi, "for instance"],
      [/in my opinion/gi, "I think"],
      [/nevertheless/gi, "even so"],
      [/subsequently/gi, "later"],
      [/furthermore/gi, "also"],
      [/in addition/gi, "plus"],
      [/therefore/gi, "so"],
      [/consequently/gi, "as a result"],
      [/despite the fact that/gi, "although"],
      [/prior to/gi, "before"],
      [/due to the fact that/gi, "because"],
      [/in the event that/gi, "if"],
      [/with regard to/gi, "about"],
    ];
    
    let newSentence = sentence;
    let madeReplacement = false;
    
    for (const [pattern, replacement] of replacements) {
      if (pattern.test(newSentence)) {
        newSentence = newSentence.replace(pattern, replacement);
        madeReplacement = true;
      }
    }
    
    // If we couldn't find any pattern matches, try more aggressive transformations
    if (!madeReplacement) {
      // Try to add an intensifier or personal opinion
      const intensifiers = [
        " Really amazing, right?",
        " I find that incredible.",
        " That's pretty remarkable.",
        " It's quite something, isn't it?",
        " Fascinating, I'd say."
      ];
      
      // 40% chance to add intensifier to end of sentence
      if (Math.random() < 0.4) {
        // Remove the ending punctuation, add the intensifier, then restore punctuation
        const punctuation = newSentence.match(/[.!?]$/)[0] || '.';
        newSentence = newSentence.slice(0, -1) + intensifiers[Math.floor(Math.random() * intensifiers.length)];
        madeReplacement = true;
      }
    }
    
    if (madeReplacement) {
      resultSentences[i] = newSentence;
      modifiedIndices.add(i);
      modifiedCount++;
    }
  }

  // Third pass: Apply contractions to the entire text
  let result = resultSentences.join(' ')
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
  
  // Check if we need to add a personal touch at the start
  if (!result.includes("Picture this") && !result.includes("Imagine") && !result.includes("Let me tell")) {
    result = "Here's a more conversational version: " + result;
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
