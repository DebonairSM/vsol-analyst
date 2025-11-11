/*
  Warnings:

  - You are about to drop the column `sprint` on the `UserStory` table. All the data in the column will be lost.
  - You are about to drop the column `storyPoints` on the `UserStory` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StatusTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userStoryId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "transitionedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusTransition_userStoryId_fkey" FOREIGN KEY ("userStoryId") REFERENCES "UserStory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserStory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "benefit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "team" TEXT NOT NULL DEFAULT 'Team Sunny',
    "acceptanceCriteria" JSONB NOT NULL,
    "epicId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalStoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserStory_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserStory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserStory_originalStoryId_fkey" FOREIGN KEY ("originalStoryId") REFERENCES "UserStory" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
INSERT INTO "new_UserStory" ("acceptanceCriteria", "action", "actor", "benefit", "createdAt", "effort", "epicId", "id", "originalStoryId", "priority", "projectId", "status", "title", "updatedAt") SELECT "acceptanceCriteria", "action", "actor", "benefit", "createdAt", "effort", "epicId", "id", "originalStoryId", "priority", "projectId", "status", "title", "updatedAt" FROM "UserStory";
DROP TABLE "UserStory";
ALTER TABLE "new_UserStory" RENAME TO "UserStory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
