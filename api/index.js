const express = require('express');
const OpenAI = require('openai');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

// Load profile data from txt file
const profilePath = path.join(__dirname, '..', 'data', 'profile.txt');
const profileContent = fs.readFileSync(profilePath, 'utf8');

// Function to determine if we should suggest a meeting
function shouldTriggerMeetingSuggestion(conversationHistory, currentMessage) {
  // Count total exchanges
  const totalExchanges = conversationHistory.length + 1;
  
  // Keywords that suggest collaboration interest
  const collaborationKeywords = [
    'collaborate', 'work together', 'partnership', 'project', 'hire', 'job',
    'internship', 'opportunity', 'connect', 'meet', 'call', 'discuss',
    'interested in', 'tell me more', 'how can we', 'would you be interested'
  ];
  
  // Check if current message contains collaboration keywords
  const currentMessageLower = currentMessage.toLowerCase();
  const hasCollaborationKeywords = collaborationKeywords.some(keyword => 
    currentMessageLower.includes(keyword)
  );
  
  // Check conversation history for collaboration keywords
  const historyText = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();
  const hasHistoryCollaborationKeywords = collaborationKeywords.some(keyword => 
    historyText.includes(keyword)
  );
  
  // Trigger meeting suggestion if:
  // 1. 3+ exchanges AND has collaboration keywords, OR
  // 2. 5+ exchanges regardless of keywords, OR
  // 3. Explicit collaboration interest
  return (totalExchanges >= 3 && hasCollaborationKeywords) || 
         totalExchanges >= 5 || 
         hasHistoryCollaborationKeywords ||
         currentMessageLower.includes('calendly') ||
         currentMessageLower.includes('schedule');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Create rate limiter
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Middleware to parse JSON bodies
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://thalenabadia.com',
    'http://localhost:5501',
    'http://127.0.0.1:5501'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint with OpenAI integration and rate limiting
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Add message length limit
    if (message.length > 500) {
      return res.status(400).json({ error: 'Message is too long. Maximum length is 500 characters.' });
    }

    // Use the profile content directly as the system prompt
    const systemPrompt = profileContent;

    // Build conversation context
    const conversationContext = conversationHistory.length > 0 
      ? `\n\nCONVERSATION HISTORY:\n${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    // Determine if we should suggest a meeting based on conversation patterns
    const shouldSuggestMeeting = shouldTriggerMeetingSuggestion(conversationHistory, message);

    // Prepare the messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `${systemPrompt}${conversationContext}

PERSONALITY & COMMUNICATION STYLE:
- Be conversational and engaging, like you're talking to a potential collaborator
- Show genuine interest in their questions and projects
- Be helpful and informative while staying authentic to Thalen's voice
- Use 2-4 sentences for most responses, but feel free to elaborate when discussing interesting topics
- Ask follow-up questions when appropriate to keep the conversation flowing
- Be enthusiastic about technology, AI, and social impact projects

MEETING SCHEDULING GUIDANCE:
${shouldSuggestMeeting ? `- The user seems interested in collaboration or has asked multiple questions. Suggest scheduling a meeting with: "Want to chat more about this? I'd love to schedule a quick call - here's my Calendly: https://calendly.com/thalenabadia/30min"` : '- Only suggest meeting scheduling if they ask about collaboration, partnerships, or seem very interested in working together'}

RESPONSE GUIDELINES:
- Stay factual and use only the provided information about Thalen
- Be friendly but professional
- If asked about something not in the data, say "I'm not sure about that specific detail, but I'd be happy to connect you with Thalen directly"
- Show passion for the projects and technologies mentioned
- Keep responses natural and conversational, not robotic`
      },
      {
        role: 'user',
        content: message
      }
    ];

    console.log('Calling OpenAI with messages:', JSON.stringify(messages, null, 2));

    // Call OpenAI GPT-3.5-turbo (cheapest model)
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 100,
      temperature: 0.7,
      top_p: 1,
    });
    
    res.json({ 
      response: response.choices[0].message.content.trim()
    });
  } catch (error) {
    console.error('Detailed error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name
    });
    
    // Return a more specific error message
    res.status(500).json({ 
      error: `OpenAI API error: ${error.message || 'Unknown error'}`,
      code: error.code
    });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export the Express API
module.exports = app; 