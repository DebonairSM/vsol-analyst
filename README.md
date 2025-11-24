# VSol Analyst

AI-powered business requirements discovery tool that helps gather and document system requirements through natural conversation.

## Overview

VSol Analyst is a web-based application that facilitates requirements gathering for software projects. The system uses AI to conduct interactive conversations with clients, analyze uploaded documents, extract structured requirements, and generate technical documentation including user stories and workflow diagrams.

## Key Features

- Google OAuth authentication with role-based access
- Project-based conversation management
- File upload and analysis (Excel spreadsheets, images/screenshots)
- AI vision support for diagram and mockup analysis
- Structured requirements extraction
- User story generation with epics and acceptance criteria
- Mermaid workflow diagram generation
- Admin dashboard for monitoring client sessions
- Persistent chat history per project
- Automated hourly database backups to OneDrive

## Installation

### Prerequisites

- Node.js (v20 or higher)
- npm
- Google Cloud account (for OAuth setup)
- OpenAI API account

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vsol-analyst
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # OpenAI API Key
   OPENAI_API_KEY=sk-your-actual-key-here
   
   # Database (SQLite - file path)
   DATABASE_URL=file:./prisma/dev.db
   
   # Google OAuth Credentials
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   CALLBACK_URL=http://localhost:5051/auth/google/callback
   
   # Session Secret
   SESSION_SECRET=random-secret-string-change-in-production
   
   # Optional: Server configuration
   PORT=5051
   HOST=0.0.0.0  # Listen on all interfaces (allows network access)
   
   # Optional: Custom backup location
   BACKUP_PATH=C:\custom\backup\path
   ```

4. **Set up Google OAuth**
   
   a. Go to [Google Cloud Console](https://console.cloud.google.com/)
   
   b. Create a new project or select an existing one
   
   c. Enable the Google+ API:
      - Navigate to "APIs & Services" > "Library"
      - Search for "Google+ API" and enable it
   
   d. Create OAuth 2.0 credentials:
      - Navigate to "APIs & Services" > "Credentials"
      - Click "Create Credentials" > "OAuth client ID"
      - Select "Web application"
      - Add authorized redirect URIs:
        - `http://localhost:5051/auth/google/callback` (for local development)
        - `http://vsol-aurora:5051/auth/google/callback` (if using custom DNS name)
      - Copy the Client ID and Client Secret to your `.env` file
   
   **Note:** You can add multiple redirect URIs to support different hostnames. Just ensure the `CALLBACK_URL` in your `.env` matches one of them.

5. **Get OpenAI API Key**
   
   Visit https://platform.openai.com/api-keys and create a new API key.

6. **Initialize the database**
   ```bash
   npx prisma migrate dev
   ```
   
   This creates the SQLite database with all required tables.

7. **Start the server**
   ```bash
   npm run dev
   ```
   
   The application will be available at http://localhost:5051

8. **Set up admin access (optional)**
   
   a. Log in with your Google account at http://localhost:5051
   
   b. Open Prisma Studio:
      ```bash
      npx prisma studio
      ```
   
   c. Navigate to the `User` table and set `isAdmin` to `true` for your user
   
   d. Refresh your browser to access the admin dashboard

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Yes |
| `DATABASE_URL` | Database connection string | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `CALLBACK_URL` | OAuth callback URL | Yes |
| `SESSION_SECRET` | Session encryption secret | Yes |
| `PORT` | Server port (defaults to 5051) | No |
| `HOST` | Server host binding (defaults to 0.0.0.0) | No |
| `BACKUP_PATH` | Custom backup directory path | No |
| `MCP_API_KEY` | API key for MCP server HTTP mode | No |

### Model Configuration

The application uses two OpenAI models:

- **gpt-4o-mini**: Default model for chat, requirements extraction, and story generation (cost-optimized)
- **gpt-4o**: Automatic refinement model when quality issues are detected

Refinement triggers:
- Requirements: Missing actor/module relationships, orphaned components
- User stories: Missing acceptance criteria, vague actions, quality score below 70/100

## Usage

### For Clients

1. **Create a project**
   - Sign in with your Google account
   - Create a new project or select an existing one

2. **Conduct requirements gathering**
   - Chat with the AI about your business needs
   - Upload Excel spreadsheets for automatic structure analysis
   - Upload images/screenshots for AI vision analysis
   - All conversations and files are saved per project

3. **Extract requirements**
   - Click "Extract Requirements" when ready
   - System generates structured requirements document
   - Output includes Mermaid workflow diagram
   - Download requirements.md and workflow.mmd files

4. **Generate user stories (optional)**
   - Generate user stories from extracted requirements
   - Output includes epics, acceptance criteria, and priority levels
   - Download user-stories.md file

### For Administrators

1. **Access admin dashboard**
   - Log in with an admin account
   - Click "Admin Dashboard" on the projects page

2. **Monitor system usage**
   - View total users, projects, and sessions
   - Browse all users and their projects
   - View any client's chat history (read-only)
   - Review extracted requirements

### Database Management

**View and edit database:**
```bash
npx prisma studio
```

**Database Backups:**

The system automatically backs up the database every hour while the application is running.

- **Backup Location**: `%USERPROFILE%\OneDrive\Documents\backups\Sunny\`
- **Frequency**: Hourly (at the top of each hour when app is running)
- **Retention**: 10 most recent backups
- **Format**: Timestamped SQLite files (e.g., `sunny-dev-2025-11-24_13-23-48-244Z.db`)

**Manual backup:**
```bash
npm run backup
```

**Custom backup location:**
Add to your `.env` file:
```env
BACKUP_PATH=C:\custom\backup\path
```

**Restore from backup:**
See [RESTORE.md](./RESTORE.md) for detailed restore instructions with paths.

## MCP Server Integration

Sunny includes a Model Context Protocol (MCP) server that enables programmatic access to project data through Cursor and other MCP-compatible tools.

### Two Operating Modes

The MCP server can run in two modes:

#### Mode 1: Direct Database Access (Default)
- Accesses the SQLite database directly
- **Cannot run simultaneously with the dev server** (SQLite locking issue)
- Use for standalone MCP access when dev server is not running

#### Mode 2: HTTP API (Recommended for Development)
- Calls the dev server's REST API
- **Can run alongside the dev server** without conflicts
- Requires dev server to be running
- Uses API key authentication

### Setup Mode 1: Direct Database Access

1. **Start the MCP server**
   ```bash
   npm run mcp
   ```

2. **Configure in Cursor**
   
   Add to Cursor settings (Settings > Features > Model Context Protocol):
   
   ```json
   {
     "mcpServers": {
       "sunny": {
         "command": "npm",
         "args": ["run", "mcp"],
         "cwd": "/path/to/vsol-analyst",
         "env": {
           "DATABASE_URL": "file:./prisma/dev.db"
         }
       }
     }
   }
   ```

### Setup Mode 2: HTTP API (Recommended)

1. **Add MCP_API_KEY to your `.env` file**
   ```env
   MCP_API_KEY=your-secure-random-api-key-here
   ```
   Generate a secure random string for the API key.

2. **Start the dev server**
   ```bash
   npm run dev
   ```

3. **Configure in Cursor**
   
   Add to Cursor settings (Settings > Features > Model Context Protocol):
   
   After building the project (`npm run build`), use:
   
   ```json
   {
     "mcpServers": {
       "sunny": {
         "command": "node",
         "args": ["C:\\git\\vsol-analyst\\dist\\mcp\\server-http.js"],
         "env": {
           "MCP_API_KEY": "your-secure-random-api-key-here",
           "API_BASE_URL": "http://localhost:5051"
         }
       }
     }
   }
   ```
   
   Replace the path with your actual project path.

### Available MCP Tools

The MCP server provides the following tools for interacting with Sunny:

**Read Operations:**
- `list_projects` - List all projects with metadata
- `get_user_stories` - Get user stories grouped by epic for a project
- `get_requirements` - Get requirements document in markdown format
- `get_diagrams` - Get workflow and flowchart diagrams (Mermaid format)
- `get_seed_data` - Get seed data (JSON, SQL, or CSV format)

**Update Operations:**
- `update_user_story` - Update story fields (status, priority, effort, etc.)
- `update_user_story_status` - Quick status change convenience tool

### Available MCP Resources

Access project data through resource URIs:

- `sunny://project/{projectId}/requirements` - Requirements markdown
- `sunny://project/{projectId}/workflow-diagram` - Workflow Mermaid diagram
- `sunny://project/{projectId}/flowchart` - Detailed flowchart diagram
- `sunny://project/{projectId}/seed-data` - Seed data JSON
- `sunny://project/{projectId}/user-stories` - User stories markdown

### Status, Priority, and Effort Values

**Status:**
- OPEN
- IN_PROGRESS
- READY_FOR_REVIEW
- IN_REVIEW
- DONE
- REMOVED

**Priority:**
- MUST_HAVE
- SHOULD_HAVE
- NICE_TO_HAVE

**Effort:**
- SMALL
- MEDIUM
- LARGE

### Example Usage in Cursor

Once configured, you can use natural language in Cursor to interact with Sunny:

- "Show me all projects in Sunny"
- "Get user stories for project xyz123"
- "Update story abc456 status to IN_PROGRESS"
- "Show me the requirements document for project xyz123"
- "Get the workflow diagram for this project"

The MCP server runs independently from the main web application and provides read and update access to project data without requiring web UI interaction.

## Architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express with modular routing
- **Database**: SQLite with Prisma ORM
- **Authentication**: Passport.js with Google OAuth 2.0
- **AI Models**: OpenAI GPT-4 and GPT-4o-mini
- **Session Management**: express-session
- **File Processing**: Multer for uploads, xlsx for spreadsheet analysis
- **Backup Scheduling**: node-cron for automated hourly backups

### Project Structure

```
vsol-analyst/
├── src/
│   ├── auth/              # Authentication (Passport, middleware)
│   ├── routes/            # API route modules
│   ├── llm/               # LLM provider abstraction
│   ├── analyst/           # Core analyst logic
│   ├── backup/            # Database backup utilities
│   ├── mcp/               # MCP server for Cursor integration
│   ├── utils/             # Shared utilities
│   └── server.ts          # Express server
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── public/                # Web UI (HTML, CSS, JS)
├── uploads/               # File uploads (images, spreadsheets)
├── docs/                  # Technical documentation
├── tests/                 # Test suites
└── package.json
```

### Database Schema

- **User**: Stores user info from Google OAuth, includes admin flag
- **Company**: Organizational container (one per user by default)
- **Project**: User's individual projects
- **ChatSession**: Stores conversation history as JSON, linked to projects
- **Attachment**: Stores uploaded files with metadata

### User Roles

**Client Users** (default):
- Create and manage own projects
- Chat with AI about business requirements
- Extract and download requirements
- Access own data only

**Admin Users**:
- All client user capabilities
- Access to admin dashboard
- View all users and projects
- Monitor any client's sessions
- System-wide statistics

## API Endpoints

### Authentication
- `GET /auth/google` - Initiate OAuth flow
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project

### Analyst
- `POST /analyst/chat` - Chat with AI
- `POST /analyst/upload-excel` - Upload and analyze spreadsheet
- `POST /analyst/upload-image` - Upload and analyze image
- `POST /analyst/extract` - Extract requirements
- `POST /analyst/generate-stories` - Generate user stories
- `POST /analyst/polish` - Polish text with AI

### Admin (requires admin role)
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/projects` - List all projects
- `GET /api/admin/projects/:id/chat` - View project chat

### Attachments
- `GET /api/attachments/:id` - Serve uploaded file

## Troubleshooting

### Using Custom DNS Names or Hostnames

If you need to access the application via a custom DNS name (e.g., `http://vsol-aurora`) instead of localhost:

1. Update `CALLBACK_URL` in your `.env` file:
   ```env
   CALLBACK_URL=http://vsol-aurora:5051/auth/google/callback
   ```
2. Add the same URL to Google Cloud Console authorized redirect URIs
3. Restart the application

### Google OAuth Error: "device_id and device_name are required"

This error occurs when accessing the application via a private IP address instead of localhost.

**Solution:**
1. Ensure `CALLBACK_URL=http://localhost:5051/auth/google/callback` is in your `.env` file
2. Access the application via `http://localhost:5051` (not `http://192.168.x.x:5051`)
3. Verify the authorized redirect URI in Google Cloud Console matches exactly
4. Restart the development server after updating `.env`

### "Not authenticated" errors

- Check that `SESSION_SECRET` is set in `.env`
- Clear browser cookies and log in again
- Verify the session middleware is properly configured

### Database errors

- Run `npx prisma migrate dev` to ensure the database schema is current
- Check that `DATABASE_URL` is correctly set in `.env`
- Verify the database file exists at the specified path

### OpenAI API errors

- Verify your `OPENAI_API_KEY` is valid at https://platform.openai.com/api-keys
- Check that you have available credits in your OpenAI account
- Monitor API rate limits if experiencing intermittent failures

### File upload errors

- Ensure the `uploads/` directory exists and has write permissions
- Check file size limits (10MB maximum)
- Verify supported file types: .xls, .xlsx for spreadsheets; .png, .jpg, .gif, .webp for images

## Deployment

### Production Considerations

1. **Environment Variables**
   - Use strong, random `SESSION_SECRET`
   - Set appropriate `CALLBACK_URL` for your domain
   - Secure storage for `OPENAI_API_KEY`

2. **Database Migration**
   
   For production deployment, migrate from SQLite to PostgreSQL:
   
   a. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   
   b. Update `.env` with PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/database"
   ```
   
   c. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

3. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

4. **Security**
   - Enable HTTPS
   - Configure CORS appropriately
   - Set secure session cookies
   - Implement rate limiting
   - Regular security audits

## Best Practices

### Working with Spreadsheets
- Upload spreadsheets early in the conversation for context
- Use descriptive sheet names (they appear in documentation)
- Include column headers in row 1 for accurate field identification
- Discuss the spreadsheet data to provide context about field meanings

### Working with Images
- Upload screenshots of existing systems, mockups, or diagrams
- Use clear, high-contrast images for better AI analysis
- Images help the AI understand visual requirements and workflows

### Extracting Requirements
- Conduct a thorough conversation before extracting requirements
- Discuss pain points, goals, users, and workflows
- Upload all relevant files during the conversation
- All context is preserved and included in the extraction

## Development

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

### Database Management
```bash
npx prisma studio     # Open database GUI
npx prisma migrate dev    # Create new migration
npx prisma generate   # Regenerate Prisma client
```

### Build and Start
```bash
npm run dev           # Development mode with hot reload
npm run build         # Compile TypeScript
npm start             # Production mode
npm run backup        # Create database backup
```

## License

MIT
