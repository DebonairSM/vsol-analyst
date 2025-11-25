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

### Quick Start (TL;DR)

1. Clone repository → `npm install`
2. **Create `.env` file** in root directory with at minimum `DATABASE_URL=file:./prisma/dev.db` (see step 3 in Installation section for complete template)
3. Run `npx prisma generate` (requires `.env` file with `DATABASE_URL`)
4. Set up Google OAuth in Google Cloud Console and get API keys (update `.env` file)
5. Run `npx prisma migrate dev` to initialize database
6. Run `npm run dev` to start the server

**Important:** The `.env` file must be created BEFORE running `npx prisma generate` because the Prisma configuration requires `DATABASE_URL` to be set.

### Prerequisites

Before installing, ensure you have:

- **Node.js** (v18 or higher, v20 recommended)
- **npm** (comes with Node.js) - **This project uses npm, not pnpm or yarn**
- **Git** (for cloning the repository)
- **Google Cloud account** (for OAuth setup)
- **OpenAI API account** (for AI features)

**Note:** Use `npm` commands throughout this guide. While the project may have a `pnpm-lock.yaml` file, `npm` is the supported package manager for this project.

### Setup Steps

Follow these steps to set up the application on a new machine:

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vsol-analyst
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   
   This installs all required npm packages including Prisma, Express, and TypeScript dependencies.
   
   **Important:** Use `npm install`, not `pnpm install` or `yarn install`. This project uses npm as the package manager.

3. **Create environment file (`.env`) - REQUIRED BEFORE NEXT STEPS**
   
   **Important:** The `.env` file must be created before running `npx prisma generate` because the Prisma configuration requires `DATABASE_URL` to be set.
   
   Create a new file named `.env` in the root directory of the project (same level as `package.json`). You can create it using:
   
   ```bash
   # Windows (PowerShell)
   New-Item -ItemType File -Path .env
   
   # Linux/Mac
   touch .env
   ```
   
   Then open the `.env` file in a text editor and add the following content. **Replace all placeholder values with your actual credentials:**
   
   ```env
   # ============================================
   # REQUIRED ENVIRONMENT VARIABLES
   # ============================================
   
   # OpenAI API Key - Get from https://platform.openai.com/api-keys
   OPENAI_API_KEY=sk-your-actual-key-here
   
   # Database connection string (SQLite for development)
   # For production, use PostgreSQL connection string like:
   # DATABASE_URL=postgresql://user:password@localhost:5432/database
   DATABASE_URL=file:./prisma/dev.db
   
   # Google OAuth Client ID - Get from Google Cloud Console
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   
   # Google OAuth Client Secret - Get from Google Cloud Console
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   # OAuth callback URL - Must match one of the authorized redirect URIs in Google Cloud Console
   CALLBACK_URL=http://localhost:5051/auth/google/callback
   
   # Session encryption secret - Use a long, random string (at least 32 characters)
   # Generate one with: openssl rand -base64 32
   SESSION_SECRET=change-this-to-a-random-secret-string-at-least-32-characters-long
   
   # ============================================
   # OPTIONAL ENVIRONMENT VARIABLES
   # ============================================
   
   # Server port (default: 5051)
   PORT=5051
   
   # Server host binding (default: 0.0.0.0 - listens on all interfaces)
   # Set to 0.0.0.0 to allow network access, or 127.0.0.1 for localhost only
   HOST=0.0.0.0
   
   # Custom backup directory path (default: %USERPROFILE%\OneDrive\Documents\backups\Sunny\)
   # BACKUP_PATH=C:\custom\backup\path
   
   # MCP API key for MCP server HTTP mode (optional)
   # Generate a secure random string if using MCP server in HTTP mode
   # MCP_API_KEY=your-secure-random-api-key-here
   
   # Redis connection URL for session storage (optional)
   # If not set, sessions will be stored in memory (lost on server restart)
   # REDIS_URL=redis://localhost:6379
   
   # Enable Redis sessions (optional, default: false)
   # Set to "true" to use Redis for session storage
   # USE_REDIS_SESSIONS=false
   
   # Allowed CORS origins (optional, comma-separated)
   # If not set, CORS is auto-configured for development
   # ALLOWED_ORIGINS=http://localhost:5051,http://example.com
   ```
   
   **Important Notes:**
   - The `.env` file should **never** be committed to version control (it's already in `.gitignore`)
   - All values marked as "Required" must be filled in before starting the server
   - Replace all placeholder values (like `your-google-client-id`) with actual values
   - Remove the `#` at the start of lines for optional variables you want to use
   - The server will validate required variables on startup and exit with an error if any are missing

5. **Set up Google OAuth and get API keys**
   
   You need to obtain credentials before you can complete the `.env` file:
   
   **a. Google OAuth Setup:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API:
     - Navigate to "APIs & Services" > "Library"
     - Search for "Google+ API" and enable it
   - Create OAuth 2.0 credentials:
     - Navigate to "APIs & Services" > "Credentials"
     - Click "Create Credentials" > "OAuth client ID"
     - Select "Web application"
     - Add authorized redirect URIs:
       - `http://localhost:5051/auth/google/callback` (for local development)
       - `http://vsol-aurora:5051/auth/google/callback` (if using custom DNS name)
     - Copy the Client ID and Client Secret to your `.env` file
   
   **Note:** You can add multiple redirect URIs to support different hostnames. Just ensure the `CALLBACK_URL` in your `.env` matches one of them.
   
   **b. Get OpenAI API Key:**
   - Visit https://platform.openai.com/api-keys and create a new API key
   - Copy it to the `OPENAI_API_KEY` variable in your `.env` file
   
   **c. Generate Session Secret:**
   - Generate a secure random string for `SESSION_SECRET`:
     ```bash
     # Windows (PowerShell)
     [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString() + (New-Guid).ToString()))
     
     # Linux/Mac
     openssl rand -base64 32
     ```
   - Copy the generated value to the `SESSION_SECRET` variable in your `.env` file

6. **Create required directories**
   
   Create directories for file uploads (these will be created automatically on first upload, but creating them now ensures proper permissions):
   ```bash
   # Windows (PowerShell)
   New-Item -ItemType Directory -Force -Path uploads\images
   New-Item -ItemType Directory -Force -Path uploads\spreadsheets
   
   # Linux/Mac
   mkdir -p uploads/images uploads/spreadsheets
   ```

7. **Initialize the database**
   ```bash
   npx prisma migrate dev
   ```
   
   This creates the SQLite database file (`prisma/dev.db`) and runs all migrations to set up the required tables (User, Company, Project, ChatSession, Attachment, Epic, UserStory, etc.).
   
   **Note:** On a fresh installation, this will create a new empty database. If you're migrating from another machine, you may need to copy the existing database file.
   
   **Important:** Ensure your `.env` file has `DATABASE_URL=file:./prisma/dev.db` (or your preferred database path) before running this command.

8. **Verify installation**
   
   Before starting the server, verify your environment variables are set correctly. The server will check for required variables and exit with an error if any are missing.
   
   You can verify your setup by checking:
   - All required environment variables are set in `.env` (especially `DATABASE_URL`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CALLBACK_URL`, and `SESSION_SECRET`)
   - Prisma client is generated (check for `node_modules/.prisma/client/`)
   - Database file exists at the path specified in `DATABASE_URL` (after running migrations)

9. **Start the development server**
   
    ```bash
    npm run dev
    ```
    
    The application will start and be available at:
    - http://localhost:5051
    - http://127.0.0.1:5051
    - http://[your-hostname]:5051 (if HOST=0.0.0.0 is set)
    
    You should see console output indicating the server is running successfully.
    
    **If you see errors about missing environment variables:** Check that your `.env` file exists and contains all required variables (see step 3).

10. **Set up admin access (optional)**
   
    To enable admin features:
    
    a. Log in with your Google account at http://localhost:5051
    
    b. Open Prisma Studio in a separate terminal:
       ```bash
       npx prisma studio
       ```
    
    c. Navigate to the `User` table and find your user record
    
    d. Edit your user and set `isAdmin` to `true`
    
    e. Refresh your browser to access the admin dashboard

## Configuration

### Environment Variables

The application uses environment variables for configuration. All environment variables are read from a `.env` file in the root directory. See the **Installation** section above for a complete `.env` file template.

#### Required Variables

The following environment variables are **required** and must be set before starting the server:

| Variable | Description | How to Get |
|----------|-------------|------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Create at https://platform.openai.com/api-keys |
| `DATABASE_URL` | Database connection string | Use `file:./prisma/dev.db` for SQLite development |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Create OAuth credentials in Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Same as above |
| `CALLBACK_URL` | OAuth callback URL | Must match authorized redirect URI in Google Cloud Console |
| `SESSION_SECRET` | Session encryption secret | Generate with: `openssl rand -base64 32` |

#### Optional Variables

These variables have defaults and are optional:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5051` |
| `HOST` | Server host binding (`0.0.0.0` for all interfaces, `127.0.0.1` for localhost only) | `0.0.0.0` |
| `BACKUP_PATH` | Custom backup directory path | `%USERPROFILE%\OneDrive\Documents\backups\Sunny\` |
| `MCP_API_KEY` | API key for MCP server HTTP mode | Not set (MCP HTTP mode disabled) |
| `REDIS_URL` | Redis connection URL (for session storage) | Not set (uses in-memory sessions) |
| `USE_REDIS_SESSIONS` | Enable Redis session store (`true` or `false`) | `false` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | Auto-configured for development |

#### Complete `.env` File Template

For a complete `.env` file template with all variables documented, see step 4 in the **Installation** section above.

**Validation:** The server validates required environment variables on startup and exits with an error if any are missing. This prevents the application from starting in an invalid configuration.

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

1. **Stop the server** if it's running
2. **Locate your backup file** in the backup directory (format: `sunny-dev-YYYY-MM-DD_HH-MM-SS-mmmZ.db`)
3. **Copy the backup file** to overwrite the current database:

   **Windows (PowerShell):**
   ```powershell
   Copy-Item "C:\Users\<username>\OneDrive\Documents\backups\Sunny\<backup-filename>" "C:\git\vsol-analyst\prisma\dev.db" -Force
   ```

   **Windows (Command Prompt):**
   ```cmd
   copy "C:\Users\<username>\OneDrive\Documents\backups\Sunny\<backup-filename>" "C:\git\vsol-analyst\prisma\dev.db" /Y
   ```

   **Linux/Mac:**
   ```bash
   cp ~/OneDrive/Documents/backups/Sunny/<backup-filename> ./prisma/dev.db
   ```

4. **Restart the server**: `npm run dev`

**Note:** The backup directory is shared by multiple applications. Sunny backups are stored in the `Sunny` subfolder. A restore instructions file (`Sunny-RESTORE.md`) is automatically created in the backup directory with your specific paths.

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

## External Access / Tunneling

If you need to access the application from outside your local network, you can use tunneling services like ngrok or Cloudflare Tunnel. This is useful for:
- Sharing the application with clients or team members
- Testing OAuth flows from external devices
- Development on remote servers

### Option 1: ngrok (Quick Setup)

ngrok provides a quick way to create a secure tunnel to your local server.

#### Installation

1. **Sign up for ngrok** at https://ngrok.com/ (free tier available)
2. **Install ngrok**:
   ```bash
   # Windows (using Chocolatey)
   choco install ngrok
   
   # Or download from https://ngrok.com/download
   # Extract and add to PATH
   
   # Mac (using Homebrew)
   brew install ngrok/ngrok/ngrok
   
   # Linux
   curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt update && sudo apt install ngrok
   ```

3. **Authenticate** with your ngrok account:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
   Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken

#### Starting the Tunnel

1. **Start your application**:
   ```bash
   npm run dev
   ```

2. **In a separate terminal, start ngrok**:
   ```bash
   ngrok http 5051
   ```

3. **Get your public URL**:
   ngrok will display a forwarding URL like:
   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:5051
   ```

#### Configuration

1. **Update your `.env` file** with the ngrok URL:
   ```env
   CALLBACK_URL=https://your-ngrok-url.ngrok.io/auth/google/callback
   ```

2. **Update Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Credentials"
   - Edit your OAuth 2.0 Client ID
   - Add the ngrok URL to "Authorized redirect URIs":
     ```
     https://your-ngrok-url.ngrok.io/auth/google/callback
     ```

3. **Restart your application** to pick up the new `CALLBACK_URL`

**Note:** The application already includes ngrok support in CORS configuration, so it will automatically accept requests from ngrok URLs in development mode.

#### Using a Reserved Domain (ngrok Pro)

If you have ngrok Pro, you can use a reserved domain:

```bash
ngrok http 5051 --domain=your-reserved-domain.ngrok.io
```

This gives you a stable URL that doesn't change between sessions.

### Option 2: Cloudflare Tunnel (Free, More Stable)

Cloudflare Tunnel (formerly Argo Tunnel) provides a free, stable tunnel that doesn't require exposing ports or changing firewall rules.

#### Installation

1. **Install cloudflared**:
   ```bash
   # Windows (using Chocolatey)
   choco install cloudflared
   
   # Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   
   # Mac (using Homebrew)
   brew install cloudflare/cloudflare/cloudflared
   
   # Linux
   # Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. **Login to Cloudflare**:
   ```bash
   cloudflared tunnel login
   ```
   This will open a browser window for authentication.

#### Creating a Tunnel

1. **Create a tunnel**:
   ```bash
   cloudflared tunnel create vsol-analyst
   ```
   This creates a tunnel named "vsol-analyst" and saves credentials to `~/.cloudflared/`

2. **Create a configuration file** at `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: C:\Users\<username>\.cloudflared\<tunnel-id>.json
   
   ingress:
     - hostname: vsol-analyst.yourdomain.com
       service: http://localhost:5051
     - service: http_status:404
   ```
   
   Replace:
   - `<tunnel-id>` with the tunnel ID from step 1
   - `<username>` with your Windows username
   - `vsol-analyst.yourdomain.com` with your desired subdomain

3. **Create DNS record** (optional if using your own domain):
   ```bash
   cloudflared tunnel route dns vsol-analyst vsol-analyst.yourdomain.com
   ```

#### Running the Tunnel

**For testing (temporary URL):**
```bash
cloudflared tunnel --url http://localhost:5051
```

**For production (with config file):**
```bash
cloudflared tunnel run vsol-analyst
```

Or set it up as a Windows service:
```bash
cloudflared service install
cloudflared tunnel run vsol-analyst
```

#### Configuration

1. **Update your `.env` file** with your Cloudflare tunnel URL:
   ```env
   CALLBACK_URL=https://vsol-analyst.yourdomain.com/auth/google/callback
   # Or if using temporary URL:
   # CALLBACK_URL=https://temporary-url.cfargotunnel.com/auth/google/callback
   ```

2. **Update Google OAuth**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to "APIs & Services" > "Credentials"
   - Edit your OAuth 2.0 Client ID
   - Add your tunnel URL to "Authorized redirect URIs"

3. **Restart your application**

### Security Considerations

When using tunnels for external access:

1. **Use HTTPS**: Both ngrok and Cloudflare Tunnel provide HTTPS automatically
2. **Limit Access**: Consider restricting access if exposing sensitive data
3. **Monitor Usage**: Keep an eye on who can access the application
4. **Session Security**: Ensure `SESSION_SECRET` is strong and random
5. **Rate Limiting**: The application already includes rate limiting, which helps protect against abuse

### Troubleshooting Tunnels

**Connection refused errors:**
- Ensure your application is running on the correct port (default: 5051)
- Check that `HOST=0.0.0.0` is set in your `.env` file

**OAuth redirect errors:**
- Verify the `CALLBACK_URL` in `.env` exactly matches the tunnel URL
- Ensure the URL is added to Google Cloud Console authorized redirect URIs
- Wait a few minutes after updating OAuth settings

**ngrok browser warning:**
- The application automatically sets the `ngrok-skip-browser-warning` header, so you shouldn't see warnings

**Cloudflare Tunnel connection issues:**
- Verify your tunnel credentials are correct in the config file
- Check that DNS records are properly configured (if using custom domain)
- Ensure cloudflared service is running (if set up as service)

## Troubleshooting

### Package Manager Errors

**"pnpm: The term 'pnpm' is not recognized" or "yarn: command not found"**

- **Solution:** This project uses **npm** as the package manager, not pnpm or yarn
- Use `npm` commands instead:
  - `npm install` (not `pnpm install` or `yarn install`)
  - `npm run dev` (not `pnpm dev` or `yarn dev`)
  - `npm run build` (not `pnpm build` or `yarn build`)
- All commands in this README use `npm` - follow the examples as written
- If you see a `pnpm-lock.yaml` file, it can be ignored - the project uses `npm` and `package-lock.json`

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
- If migrating from another machine, copy the database file and ensure Prisma client is generated: `npx prisma generate`
- Ensure the `prisma/` directory and all migrations are present

### OpenAI API errors

- Verify your `OPENAI_API_KEY` is valid at https://platform.openai.com/api-keys
- Check that you have available credits in your OpenAI account
- Monitor API rate limits if experiencing intermittent failures

### File upload errors

- Ensure the `uploads/` directory exists and has write permissions
- Check file size limits (10MB maximum)
- Verify supported file types: .xls, .xlsx for spreadsheets; .png, .jpg, .gif, .webp for images
- Create required upload directories if they don't exist:
  ```bash
  mkdir -p uploads/images
  mkdir -p uploads/spreadsheets
  ```

### Prisma Client errors

- **"Missing required environment variable: DATABASE_URL"** when running `npx prisma generate`:
  - **Solution:** Create the `.env` file with `DATABASE_URL=file:./prisma/dev.db` BEFORE running `npx prisma generate`
  - The Prisma configuration file (`prisma.config.ts`) requires `DATABASE_URL` to be set
  - The `.env` file must exist in the root directory before generating the Prisma client
  - See Installation step 3 for complete `.env` file template
  
- If you see "PrismaClient is not generated" errors, run: `npx prisma generate`
- This should be done after `npm install` and whenever the Prisma schema changes
- The Prisma client is generated in `node_modules/.prisma/client/`
- **Important:** Always create the `.env` file BEFORE running `npx prisma generate`

### Missing required environment variables

- The server checks for `SESSION_SECRET` and `OPENAI_API_KEY` on startup
- If startup fails, check the console error message for the missing variable name
- Ensure your `.env` file is in the root directory (same level as `package.json`)
- Verify there are no syntax errors in the `.env` file:
  - No spaces around `=` signs (use `KEY=value`, not `KEY = value`)
  - No quotes needed for most values (unless the value contains special characters)
  - Each variable on its own line
  - Comments start with `#`
- If the `.env` file doesn't exist, create it (see Installation step 3 for template)
- Make sure you've replaced all placeholder values with actual credentials
- Verify file permissions allow reading the `.env` file
- **Critical:** The `.env` file must exist and have `DATABASE_URL` set before running `npx prisma generate`

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
