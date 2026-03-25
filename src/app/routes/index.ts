import { Router } from "express";
import { AdminRoutes } from "../module/admin/admin.route";
import { ApplicationRoutes } from "../module/application/application.route";
import { AuthRoutes } from "../module/auth/auth.route";
import { CouponRoutes } from "../module/coupon/coupon.route";
import { JobRoutes } from "../module/job/job.route";
import { NotificationRoutes } from "../module/notification/notification.route";
import { RecruiterRoutes } from "../module/recruiter/recruiter.route";
import { ReferralRoutes } from "../module/referral/referral.route";
import { ResumeRoutes } from "../module/resume/resume.route";
import { StatsRoutes } from "../module/stats/stats.route";
import { SubscriptionRoutes } from "../module/subscription/subscription.route";
import { TrackingRoutes } from "../module/tracking/tracking.route";
import { UserRoutes } from "../module/user/user.route";

const router = Router();

router.use("/auth", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/admins", AdminRoutes);
router.use("/recruiters", RecruiterRoutes);
router.use("/jobs", JobRoutes);
router.use("/applications", ApplicationRoutes);
router.use("/resumes", ResumeRoutes);
router.use("/subscriptions", SubscriptionRoutes);
router.use("/tracking", TrackingRoutes);
router.use("/coupons", CouponRoutes);
router.use("/notifications", NotificationRoutes);
router.use("/referrals", ReferralRoutes);
router.use("/stats", StatsRoutes);


export const IndexRoutes = router;
