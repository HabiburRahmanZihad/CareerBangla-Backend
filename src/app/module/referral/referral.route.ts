import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { ReferralController } from "./referral.controller";

const router = Router();

router.get("/my-stats",
    checkAuth(Role.USER, Role.RECRUITER),
    ReferralController.getMyReferralStats);

router.get("/search",
    checkAuth(Role.USER, Role.RECRUITER),
    ReferralController.searchReferrals);

export const ReferralRoutes = router;
