import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CouponController } from "./coupon.controller";
import { createCouponZodSchema, createGiftVoucherZodSchema, redeemCodeZodSchema } from "./coupon.validation";

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

// Gift vouchers
router.post("/gift-voucher",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createGiftVoucherZodSchema),
    CouponController.createGiftVoucher);

router.get("/gift-vouchers",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.getAllGiftVouchers);

router.delete("/gift-voucher/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    CouponController.deleteGiftVoucher);

// Redeem
router.post("/redeem",
    checkAuth(Role.USER, Role.RECRUITER),
    validateRequest(redeemCodeZodSchema),
    CouponController.redeemCoupon);

router.post("/redeem-gift-voucher",
    checkAuth(Role.USER, Role.RECRUITER),
    validateRequest(redeemCodeZodSchema),
    CouponController.redeemGiftVoucher);

export const CouponRoutes = router;
