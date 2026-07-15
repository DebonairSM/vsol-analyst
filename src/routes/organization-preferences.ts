import { randomUUID } from "node:crypto";
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import {
  normalizeOrganizationPreferences,
  normalizePreferenceInput,
  removeOrganizationPreference,
  upsertOrganizationPreference,
} from "../analyst/OrganizationPreferences";
import { asyncHandler } from "../utils/async-handler";
import { NotFoundError, ValidationError } from "../utils/errors";
import { prisma } from "../utils/prisma";
import { getAuthenticatedUser } from "../utils/prisma-helpers";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const company = await findOwnedCompany(req.user, req.query.companyId);
  res.json({
    companyId: company.id,
    preferences: normalizeOrganizationPreferences(company.discoveryPreferences),
  });
}));

router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const company = await findOwnedCompany(req.user, req.body?.companyId);
  let input;
  try {
    input = normalizePreferenceInput(req.body);
  } catch (error) {
    throw new ValidationError((error as Error).message);
  }
  const preferences = upsertOrganizationPreference(
    company.discoveryPreferences,
    randomUUID(),
    input
  );
  await prisma.company.update({
    where: { id: company.id },
    data: { discoveryPreferences: preferences as any },
  });
  res.status(201).json({ companyId: company.id, preferences });
}));

router.patch("/:itemId", requireAuth, asyncHandler(async (req, res) => {
  const company = await findOwnedCompany(req.user, req.body?.companyId);
  const current = normalizeOrganizationPreferences(company.discoveryPreferences);
  if (!current.items.some((item) => item.id === req.params.itemId)) {
    throw new NotFoundError("Organization preference");
  }
  let input;
  try {
    input = normalizePreferenceInput(req.body);
  } catch (error) {
    throw new ValidationError((error as Error).message);
  }
  const preferences = upsertOrganizationPreference(
    current,
    req.params.itemId,
    input
  );
  await prisma.company.update({
    where: { id: company.id },
    data: { discoveryPreferences: preferences as any },
  });
  res.json({ companyId: company.id, preferences });
}));

router.delete("/:itemId", requireAuth, asyncHandler(async (req, res) => {
  const company = await findOwnedCompany(req.user, req.query.companyId);
  const current = normalizeOrganizationPreferences(company.discoveryPreferences);
  if (!current.items.some((item) => item.id === req.params.itemId)) {
    throw new NotFoundError("Organization preference");
  }
  const preferences = removeOrganizationPreference(current, req.params.itemId);
  await prisma.company.update({
    where: { id: company.id },
    data: { discoveryPreferences: preferences as any },
  });
  res.json({ companyId: company.id, preferences });
}));

async function findOwnedCompany(userValue: unknown, companyIdValue: unknown) {
  const user = getAuthenticatedUser(userValue);
  const companyId =
    typeof companyIdValue === "string" && companyIdValue.trim()
      ? companyIdValue.trim()
      : undefined;
  const company = await prisma.company.findFirst({
    where: { userId: user.id, ...(companyId ? { id: companyId } : {}) },
  });
  if (!company) throw new NotFoundError("Company");
  return company;
}

export default router;
