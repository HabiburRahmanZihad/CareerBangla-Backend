import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { TrackingController } from "./tracking.controller";

const router = Router();

// Only ADMIN and SUPER_ADMIN should be able to view system tracking data
router.get("/referrals",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    TrackingController.getReferralTracking);

router.get("/coupons",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    TrackingController.getCouponUsageTracking);

export const TrackingRoutes = router;
