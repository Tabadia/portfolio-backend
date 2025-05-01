const express = require('express');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const app = express();

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: 'us-east-1', // Change this if your region is different
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

// Chat endpoint with AWS Bedrock integration
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // System prompt with information about you
    const systemPrompt = `You are an AI assistant that knows about Thalen Abadia. 
    You should be helpful, friendly, and provide accurate information about Thalen.
    If you're not sure about something, say so rather than making up information.`;

    // Prepare the prompt for Claude
    const prompt = `${systemPrompt}\n\nHuman: ${message}\n\nAssistant:`;

    // Prepare the request for Bedrock
    const params = {
      modelId: 'anthropic.claude-instant-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: prompt,
        max_tokens_to_sample: 1000,
        temperature: 0.7,
        top_p: 1,
        stop_sequences: ['\n\nHuman:']
      })
    };

    // Call Bedrock
    const command = new InvokeModelCommand(params);
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    res.json({ 
      response: responseBody.completion.trim()
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
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