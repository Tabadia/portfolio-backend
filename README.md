# Thalen Abadia Portfolio Backend

Backend server for thalenabadia.com portfolio website with AI chat functionality.

## Features

- AI-powered chat using OpenAI GPT-4o mini (cheapest model)
- Rate limiting for API protection
- CORS support for frontend integration
- Profile-based responses representing Thalen Abadia

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_KEY=your_actual_openai_api_key_here
```

4. Run the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/chat` - Chat with AI (rate limited: 50 requests per 15 minutes)

## Environment Variables

- `OPENAI_KEY` - Your OpenAI API key (required)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)

## Deployment

This backend is configured for Vercel deployment. Make sure to set the `OPENAI_KEY` environment variable in your Vercel dashboard.

## Cost Optimization

Using OpenAI's GPT-3.5-turbo model for maximum cost efficiency:
- Input tokens: $0.50 per million
- Output tokens: $1.50 per million
- Most cost-effective model for simple chat applications