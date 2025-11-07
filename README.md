# Sunny - VSol Systems Analyst Agent

AI-powered business requirements discovery tool using OpenAI with Google authentication and per-user project management.

Meet Sunny, your friendly systems analyst agent who helps gather and document business requirements through natural conversation.

## Features

- Google OAuth authentication
- Per-user project management
- Admin dashboard to monitor all client sessions
- Interactive chat with customers to understand their workflows
- Excel spreadsheet upload and analysis
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
5. Upload Excel spreadsheets (.xls, .xlsx) to share data with Sunny
6. When ready, click "Extract Requirements" to generate structured output
7. Download the requirements.md and workflow.mmd files

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

### Admin (requires admin role)

- `GET /api/admin/stats` - Get system statistics (user count, project count, session count)
- `GET /api/admin/users` - List all users with their projects
- `GET /api/admin/projects` - List all projects from all users
- `GET /api/admin/projects/:id/chat` - View chat history for any project

### Chat & Analysis

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
  "summary": "📊 Excel File: data.xlsx\nNumber of sheets: 2..."
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
  - `isAdmin` flag for admin access (default: false)
  - Auto-creates a default Company on first login
- **Company**: Organizational container (one per user initially)
- **Project**: User's individual projects
  - Each project has its own chat sessions
- **ChatSession**: Stores conversation history as JSON
  - Linked to a specific project

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

## Future Enhancements

- Multiple companies per user
- Team collaboration features
- PDF export for requirements
- Version control for requirements
- Integration with VSol Admin app
- Analytics dashboard
- Billing per seat
