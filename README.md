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
- Automated database backups

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
      - Add authorized redirect URI: `http://localhost:5051/auth/google/callback`
      - Copy the Client ID and Client Secret to your `.env` file

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
| `BACKUP_PATH` | Custom backup directory path | No |

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

**Create database backup:**
```bash
npm run backup
```

Backups are stored in `%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\` by default. The system retains the 10 most recent backups.

**Restore from backup:**
1. Stop the server
2. Copy the backup file to `prisma/dev.db`
3. Restart the server

## Architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express with modular routing
- **Database**: SQLite with Prisma ORM
- **Authentication**: Passport.js with Google OAuth 2.0
- **AI Models**: OpenAI GPT-4 and GPT-4o-mini
- **Session Management**: express-session
- **File Processing**: Multer for uploads, xlsx for spreadsheet analysis

### Project Structure

```
vsol-analyst/
├── src/
│   ├── auth/              # Authentication (Passport, middleware)
│   ├── routes/            # API route modules
│   ├── llm/               # LLM provider abstraction
│   ├── analyst/           # Core analyst logic
│   ├── backup/            # Database backup utilities
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

## Additional Documentation

Technical documentation is available in the `docs/` directory:

- `backup-setup.md` - Detailed backup configuration and scheduling
- `MERMAID_REFACTOR_SUMMARY.md` - Workflow diagram generator implementation
- `REFINEMENT_IMPLEMENTATION.md` - AI model refinement pipeline details
- `REFINEMENT_SUMMARY.md` - Quick reference for refinement features

## License

MIT
