# Sunny - VSol Systems Analyst Agent

AI-powered business requirements discovery tool using OpenAI with Google authentication and per-user project management.

Meet Sunny, your friendly systems analyst agent who helps gather and document business requirements through natural conversation.

## Features

- Google OAuth authentication
- Per-user project management
- Admin dashboard to monitor all client sessions
- Interactive chat with customers to understand their workflows
- File upload and analysis:
  - Excel spreadsheet analysis (structure, headers, data patterns)
  - Image/screenshot analysis with AI vision
  - Automatic data entity extraction from spreadsheets
- Automatic extraction of structured requirements from conversations
- Generate requirements documents in Markdown format
- Generate user stories from requirements
- Generate workflow diagrams in Mermaid format
- Text polishing with AI
- Persistent chat history per project
- Attachment storage and retrieval

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
CALLBACK_URL=http://localhost:5051/auth/google/callback

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

**Important Notes:**
- The `.env` file is in `.gitignore` and will not be committed.
- Always access the application via `http://localhost:5051` (not via IP addresses like 192.168.1.65)
- If you see a "device_id and device_name are required" error, you're trying to access the app via a private IP address. Use `localhost` instead.
- In Google Cloud Console, make sure the authorized redirect URI is exactly: `http://localhost:5051/auth/google/callback`

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

### 5. Set Up Admin Access (Optional)

To access the admin dashboard and view all client sessions:

1. First, log in with your Google account at http://localhost:5051
2. Open Prisma Studio to modify your user record:
   ```bash
   npx prisma studio
   ```
3. Navigate to the `User` table
4. Find your user record and set `isAdmin` to `true`
5. Refresh your browser

You'll now see an "ADMIN" badge in the header and an "Admin Dashboard" button on the projects page.

## Usage

### Web Interface

**For Clients:**
1. Open http://localhost:5051 in your browser
2. Sign in with your Google account
3. Create a new project or select an existing one
4. Start chatting with Sunny about your business
5. Upload files to share information with Sunny:
   - **Excel spreadsheets** (.xls, .xlsx): Automatic analysis of all sheets, rows, columns, headers, and sample data
   - **Images/Screenshots** (.png, .jpg, .gif, .webp): AI vision analysis to understand diagrams, mockups, and visual requirements
   - All file analysis is preserved in the conversation history
6. When ready, click "Extract Requirements" to generate structured output:
   - Dedicated "Uploaded Documents and Data Sources" section for all files
   - Complete spreadsheet structure documentation (sheets, columns, headers, sample data)
   - Data entities extracted from spreadsheets with field-level details
   - Image analysis insights incorporated into requirements
   - Professional markdown and Mermaid workflow diagram
7. Generate user stories from extracted requirements (optional)
8. Download the requirements.md, user-stories.md, and workflow.mmd files

**For Admins:**
1. After setting up admin access (see Setup section), log in
2. Click "Admin Dashboard" button on your projects page
3. View system statistics (total users, projects, sessions)
4. Browse all users and their projects
5. View any client's chat history in read-only mode
6. Monitor client conversations and review extracted requirements

### Database Management

View and manage your database with Prisma Studio:

```bash
npx prisma studio
```

This opens a visual interface at http://localhost:5555 to browse and edit your data.

### Database Backup

Create a backup of your database to OneDrive:

```bash
npm run backup
```

The backup script:
- Automatically backs up to `%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\`
- Creates timestamped backup files
- Keeps the 10 most recent backups
- Can be customized with the `BACKUP_PATH` environment variable

For more details on setting up scheduled backups, see [backup-setup.md](backup-setup.md).

## Architecture

The application uses a modular route-based architecture:

- **Modular Routes**: Each functional area (auth, projects, admin, analyst, attachments) has its own route module in `src/routes/`
- **Separation of Concerns**: Business logic is organized into specialized modules (LLM providers, requirements extraction, document generation)
- **Middleware**: Authentication and authorization are handled through reusable middleware
- **Type Safety**: Full TypeScript implementation with strict typing

## API Endpoints

### Authentication (`/auth`)

- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - OAuth callback handler
- `GET /auth/logout` - Logout current user
- `GET /auth/me` - Get current user info

### Projects (`/api/projects`)

- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project (requires `{ name: string }`)
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project (requires `{ name: string }`)

### Attachments (`/api/attachments`)

- `GET /api/attachments/:id` - Serve uploaded file (images, spreadsheets)

### Admin (`/api/admin`) - requires admin role

- `GET /api/admin/stats` - Get system statistics (user count, project count, session count)
- `GET /api/admin/users` - List all users with their projects
- `GET /api/admin/projects` - List all projects from all users
- `GET /api/admin/projects/:id/chat` - View chat history for any project

### Chat & Analysis (`/analyst`)

#### POST /analyst/upload-excel

Upload and analyze an Excel spreadsheet for a project.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Excel file (.xls or .xlsx, max 10MB)
  - `projectId`: Project ID

**Response:**
```json
{
  "filename": "data.xlsx",
  "sheets": {
    "Sheet1": [[...], [...]],
    "Sheet2": [[...], [...]]
  },
  "summary": "📊 Excel File: data.xlsx\nNumber of sheets: 2...",
  "attachmentId": "attachment-id",
  "storedPath": "uploads/spreadsheets/..."
}
```

#### POST /analyst/upload-image

Upload and analyze an image or screenshot for a project.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file (PNG, JPG, GIF, WebP, max 10MB)
  - `projectId`: Project ID

**Response:**
```json
{
  "filename": "screenshot.png",
  "attachmentId": "attachment-id",
  "storedPath": "uploads/images/...",
  "analysis": "AI analysis of the image..."
}
```

#### POST /analyst/chat

Start or continue a conversation with Sunny for a specific project.

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

#### POST /analyst/generate-stories

Generate user stories from a project's chat history.

**Request:**
```json
{
  "projectId": "project-id"
}
```

**Response:**
```json
{
  "userStories": [ ... ],
  "markdown": "# User Stories\n..."
}
```

#### POST /analyst/generate-stories-from-requirements

Generate user stories from cached requirements (optimized).

**Request:**
```json
{
  "requirements": { ... }
}
```

**Response:**
```json
{
  "userStories": [ ... ],
  "markdown": "# User Stories\n..."
}
```

#### POST /analyst/polish

Polish and improve text using AI.

**Request:**
```json
{
  "text": "raw text to polish"
}
```

**Response:**
```json
{
  "original": "raw text to polish",
  "polished": "Improved and polished text..."
}
```

## Technology

- **LLM:** OpenAI GPT-4 with vision support
- **Runtime:** Node.js with TypeScript
- **Framework:** Express with modular routing
- **Database:** SQLite with Prisma ORM (easily upgradeable to PostgreSQL)
- **Authentication:** Passport.js with Google OAuth 2.0
- **Session Management:** express-session
- **File Processing:** Multer for uploads, xlsx for spreadsheet analysis

## Project Structure

```
vsol-analyst/
├── src/
│   ├── auth/                    # Authentication (Passport, middleware)
│   ├── routes/                  # API route modules
│   │   ├── auth.ts              # Authentication routes
│   │   ├── projects.ts          # Project management routes
│   │   ├── attachments.ts       # File attachment routes
│   │   ├── admin.ts             # Admin dashboard routes
│   │   └── analyst.ts           # Chat and analysis routes
│   ├── llm/                     # LLM provider abstraction
│   ├── analyst/                 # Core analyst logic
│   ├── backup/                  # Database backup utilities
│   └── server.ts                # Express server
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Database migrations
├── public/                      # Web UI (HTML, CSS, JS)
├── uploads/                     # File uploads (images, spreadsheets)
├── dev.db                       # SQLite database (gitignored)
├── .env                         # Environment variables (gitignored)
└── package.json
```

## Database Schema

- **User**: Stores user info from Google OAuth
  - `isAdmin` flag for admin access (default: false)
  - Auto-creates a default Company on first login
- **Company**: Organizational container (one per user initially)
- **Project**: User's individual projects
  - Each project has its own chat sessions
- **ChatSession**: Stores conversation history as JSON
  - Linked to a specific project
  - Contains all messages and file analysis
- **Attachment**: Stores uploaded files
  - Linked to a specific chat session
  - Supports spreadsheets and images
  - Tracks file type, path, and metadata

## User Roles

The system supports two roles:

1. **Client Users** (default):
   - Can create and manage their own projects
   - Can chat with Sunny about their business
   - Can extract and download requirements
   - Only see their own data

2. **Admin Users**:
   - All client user capabilities
   - Access admin dashboard with system statistics
   - View all users and their projects
   - Monitor any client's chat sessions (read-only)
   - Review extracted requirements from all projects

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

## Troubleshooting

### Google OAuth Error: "device_id and device_name are required"

If you see this error when trying to sign in:

```
Access blocked: Authorization Error
device_id and device_name are required for private IP: http://192.168.1.65:5051/auth/google/callback
Error 400: invalid_request
```

**Solution:**

1. Make sure you added `CALLBACK_URL=http://localhost:5051/auth/google/callback` to your `.env` file
2. Access the application via `http://localhost:5051` instead of using an IP address (like `http://192.168.1.65:5051`)
3. In Google Cloud Console, verify the authorized redirect URI is set to `http://localhost:5051/auth/google/callback`
4. Restart your development server after updating `.env`

Google OAuth blocks authentication from private IP addresses in development. Always use `localhost` for local development.

### Other Common Issues

**"Not authenticated" errors:**
- Check that SESSION_SECRET is set in your `.env` file
- Clear your browser cookies and try logging in again

**Database errors:**
- Run `npx prisma migrate dev` to ensure your database is up to date
- Check that DATABASE_URL is correctly set in `.env`

**OpenAI API errors:**
- Verify your OPENAI_API_KEY is valid at https://platform.openai.com/api-keys
- Check that you have available credits in your OpenAI account

## Tips for Best Results

### Working with Spreadsheets
- Upload spreadsheets early in the conversation for context
- Use descriptive sheet names (they appear in requirements documentation)
- Include headers in row 1 of each sheet for accurate field identification
- Discuss the spreadsheet data with Sunny to provide context about field meanings
- Multiple spreadsheets can be uploaded per project

### Working with Images
- Upload screenshots of existing systems, mockups, or diagrams
- The AI will analyze and describe what it sees
- Images help Sunny understand visual requirements and workflows
- Clear, high-contrast images work best

### Extracting Requirements
- Have a thorough conversation before extracting requirements
- Discuss pain points, goals, users, and workflows
- Upload relevant files during the conversation
- All context is preserved and included in the extraction

## Future Enhancements

- Multiple companies per user
- Team collaboration features
- PDF export for requirements
- Version control for requirements
- Integration with VSol Admin app
- Analytics dashboard
- Billing per seat
- Additional file types (Word, PDF documents)
