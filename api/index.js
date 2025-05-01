const express = require('express');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

// Load profile data from txt file
const profilePath = path.join(__dirname, '..', 'data', 'profile.txt');
const profileContent = fs.readFileSync(profilePath, 'utf8');

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: 'us-east-1', // Change this if your region is different
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

// Chat endpoint with AWS Bedrock integration and rate limiting
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Add message length limit
    if (message.length > 500) {
      return res.status(400).json({ error: 'Message is too long. Maximum length is 500 characters.' });
    }

    // Use the profile content directly as the system prompt
    const systemPrompt = profileContent;

    // Prepare the prompt for Claude
    const prompt = `${systemPrompt}\n\nIMPORTANT INSTRUCTION: Respond like you're texting - use very short, casual responses (1-4 lines max). No bullet points or long explanations. Be friendly but super brief.\n\nHuman: ${message}\n\nAssistant:`;

    // Prepare the request for Bedrock
    const params = {
      modelId: 'anthropic.claude-instant-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: prompt,
        max_tokens_to_sample: 100,
        temperature: 0.7,
        top_p: 1,
        stop_sequences: ['\n\nHuman:']
      })
    };

    console.log('Calling Bedrock with params:', JSON.stringify(params, null, 2));

    // Call Bedrock
    const command = new InvokeModelCommand(params);
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    res.json({ 
      response: responseBody.completion.trim()
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
      error: `AWS Bedrock error: ${error.message || 'Unknown error'}`,
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