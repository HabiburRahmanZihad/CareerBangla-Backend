import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { SubscriptionController } from "./subscription.controller";

const router = Router();

router.get("/plans",
    SubscriptionController.getSubscriptionPlans);

router.post("/purchase",
    checkAuth(Role.USER, Role.RECRUITER),
    SubscriptionController.initiatePayment);

// IPN is mounted at app level (before CORS) in app.ts

router.post("/cancel/:subscriptionId",
    checkAuth(Role.USER, Role.RECRUITER),
    SubscriptionController.cancelSubscription);

router.get("/my-subscriptions",
    checkAuth(Role.USER, Role.RECRUITER),
    SubscriptionController.getMySubscriptions);

router.get("/invoice/:subscriptionId",
    checkAuth(Role.USER, Role.RECRUITER),
    SubscriptionController.getInvoice);

export const SubscriptionRoutes = router;
