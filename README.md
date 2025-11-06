# VSol Systems Analyst Agent

AI-powered business requirements discovery tool using OpenAI.

## Features

- Interactive chat with customers to understand their workflows
- Automatic extraction of structured requirements from conversations
- Generate requirements documents in Markdown format
- Generate workflow diagrams in Mermaid format

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI API Key

Create a `.env` file in the root directory:

```bash
echo "OPENAI_API_KEY=sk-your-actual-key-here" > .env
```

Replace `sk-your-actual-key-here` with your actual OpenAI API key.

Get your API key from: https://platform.openai.com/api-keys

**Note:** The `.env` file is already in `.gitignore` and will not be committed.

### 3. Run the Server

```bash
npm run dev
```

The server will start on port 5051 and serve the chat UI at http://localhost:5051

## Usage

### Web Interface

1. Open http://localhost:5051 in your browser
2. Start chatting with the analyst agent
3. When ready, click "Extract Requirements" to generate structured output
4. Download the requirements.md and workflow.mmd files

### API Endpoints

#### POST /analyst/chat

Start or continue a conversation with the analyst.

**Request:**
```json
{
  "sessionId": "unique-session-id",
  "message": "We run a barber shop and use Excel for appointments"
}
```

**Response:**
```json
{
  "reply": "I understand you're using Excel for appointments. How many barbers do you have, and how do customers currently book their appointments?"
}
```

#### POST /analyst/extract

Extract structured requirements from the conversation.

**Request:**
```json
{
  "sessionId": "unique-session-id"
}
```

**Response:**
```json
{
  "requirements": {
    "businessContext": { ... },
    "primaryGoal": "...",
    "painPoints": [ ... ],
    ...
  },
  "markdown": "# System Requirements\n...",
  "mermaid": "flowchart TD\n..."
}
```

## Technology

- **LLM:** OpenAI GPT-3.5-turbo (cheapest option, easily upgradeable to GPT-4)
- **Runtime:** Node.js with TypeScript
- **Framework:** Express
- **Architecture:** Provider-agnostic design for future flexibility

## Project Structure

```
vsol-analyst/
├── src/
│   ├── llm/                      # LLM provider abstraction
│   ├── analyst/                  # Core analyst logic
│   └── server.ts                 # Express server
├── public/                       # Web UI
└── package.json
```

## Future Enhancements

- Replace simple HTML UI with React (port 5050 for frontend, 5051 for backend)
- Add persistent session storage
- Add authentication
- Export to PDF
- Integration with VSol Admin app

