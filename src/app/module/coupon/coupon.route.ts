import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CouponController } from "./coupon.controller";
import { applyCouponZodSchema, createCouponZodSchema, validateCouponZodSchema } from "./coupon.validation";

const router = Router();

// User/Recruiter routes (must be before /:id to avoid param conflict)
router.post("/validate",
    checkAuth(Role.USER, Role.RECRUITER),
    validateRequest(validateCouponZodSchema),
    CouponController.validateCoupon);

router.post("/apply",
    checkAuth(Role.USER, Role.RECRUITER),
    validateRequest(applyCouponZodSchema),
    CouponController.applyCoupon);

// Admin routes
router.post("/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createCouponZodSchema),
    CouponController.createCoupon);

router.get("/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.getAllCoupons);

router.get("/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.getCouponById);

router.delete("/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.deleteCoupon);

export const CouponRoutes = router;
