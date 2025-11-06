# VSol Systems Analyst Agent

AI-powered business requirements discovery tool using OpenAI with Google authentication and per-user project management.

## Features

- Google OAuth authentication
- Per-user project management
- Interactive chat with customers to understand their workflows
- Automatic extraction of structured requirements from conversations
- Generate requirements documents in Markdown format
- Generate workflow diagrams in Mermaid format
- Persistent chat history per project

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-your-actual-key-here

# Database (SQLite - file path)
DATABASE_URL=file:./dev.db

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Session Secret (use a random string in production)
SESSION_SECRET=random-secret-string-change-in-production
```

#### Getting OpenAI API Key

Get your API key from: https://platform.openai.com/api-keys

#### Setting up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Navigate to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URI: `http://localhost:5051/auth/google/callback`
   - Copy the Client ID and Client Secret to your `.env` file

**Note:** The `.env` file is in `.gitignore` and will not be committed.

### 3. Initialize Database

Run Prisma migrations to create the SQLite database:

```bash
npx prisma migrate dev
```

This creates a `dev.db` file in your project root with the required tables:
- Users (with Google authentication)
- Companies (one per user by default)
- Projects (multiple per company)
- ChatSessions (chat history per project)

### 4. Run the Server

```bash
npm run dev
```

The server will start on port 5051 and serve the application at http://localhost:5051

## Usage

### Web Interface

1. Open http://localhost:5051 in your browser
2. Sign in with your Google account
3. Create a new project or select an existing one
4. Start chatting with the analyst agent about your business
5. When ready, click "Extract Requirements" to generate structured output
6. Download the requirements.md and workflow.mmd files

### Database Management

View and manage your database with Prisma Studio:

```bash
npx prisma studio
```

This opens a visual interface at http://localhost:5555 to browse and edit your data.

## API Endpoints

### Authentication

- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `GET /auth/logout` - Logout current user
- `GET /auth/me` - Get current user info

### Projects

- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project (requires `{ name: string }`)
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project (requires `{ name: string }`)

### Chat & Analysis

#### POST /analyst/chat

Start or continue a conversation with the analyst for a specific project.

**Request:**
```json
{
  "projectId": "project-id",
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

Extract structured requirements from the project's conversation history.

**Request:**
```json
{
  "projectId": "project-id"
}
```

**Response:**
```json
{
  "requirements": {
    "businessContext": { ... },
    "primaryGoal": "...",
    "painPoints": [ ... ]
  },
  "markdown": "# System Requirements\n...",
  "mermaid": "flowchart TD\n..."
}
```

## Technology

- **LLM:** OpenAI GPT-3.5-turbo (upgradeable to GPT-4)
- **Runtime:** Node.js with TypeScript
- **Framework:** Express
- **Database:** SQLite with Prisma ORM (easily upgradeable to PostgreSQL)
- **Authentication:** Passport.js with Google OAuth 2.0
- **Session Management:** express-session

## Project Structure

```
vsol-analyst/
├── src/
│   ├── auth/                    # Authentication (Passport, middleware)
│   ├── llm/                     # LLM provider abstraction
│   ├── analyst/                 # Core analyst logic
│   └── server.ts                # Express server
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── public/                      # Web UI (HTML, CSS, JS)
├── dev.db                       # SQLite database (gitignored)
├── .env                         # Environment variables (gitignored)
└── package.json
```

## Database Schema

- **User**: Stores user info from Google OAuth
  - Auto-creates a default Company on first login
- **Company**: Organizational container (one per user initially)
- **Project**: User's individual projects
  - Each project has its own chat sessions
- **ChatSession**: Stores conversation history as JSON
  - Linked to a specific project

## Deployment

### Migrating to PostgreSQL (for production)

When ready to deploy to Render or similar cloud platforms:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update `.env` with PostgreSQL connection string:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/database"
   ```

3. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

The Prisma schema is designed to work with both SQLite and PostgreSQL with minimal changes.

## Future Enhancements

- Multiple companies per user
- Team collaboration features
- PDF export for requirements
- Version control for requirements
- Integration with VSol Admin app
- Analytics dashboard
- Billing per seat
