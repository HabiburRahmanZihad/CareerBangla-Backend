import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CouponController } from "./coupon.controller";
import { createCouponZodSchema, validateCouponZodSchema } from "./coupon.validation";

const router = Router();

// Admin operations
router.post("/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createCouponZodSchema),
    CouponController.createCoupon);

router.get("/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.getAllCoupons);

router.delete("/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.deleteCoupon);

// Use during checkout to validate
router.post("/validate",
    checkAuth(Role.USER, Role.RECRUITER),
    validateRequest(validateCouponZodSchema),
    CouponController.validateCoupon);

export const CouponRoutes = router;
