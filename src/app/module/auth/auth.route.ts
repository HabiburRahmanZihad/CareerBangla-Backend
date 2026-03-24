import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { authRateLimiter } from "../../middleware/rateLimiter";
import { AuthController } from "./auth.controller";

const router = Router()

router.post("/register", authRateLimiter, AuthController.registerUser)
router.post("/login", authRateLimiter, AuthController.loginUser)
router.get("/me", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.getMe)
router.post("/refresh-token", AuthController.getNewToken)
router.post("/change-password", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.changePassword)
router.patch("/update-profile", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.updateProfile)
router.post("/logout", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.logoutUser)
router.post("/logout-all-devices", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.logoutAllDevices)
router.get("/active-sessions", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.getActiveSessions)
router.delete("/sessions/:sessionId", checkAuth(Role.ADMIN, Role.RECRUITER, Role.USER, Role.SUPER_ADMIN), AuthController.revokeSession)
router.post("/verify-email", authRateLimiter, AuthController.verifyEmail)
router.post("/resend-verify-email", authRateLimiter, AuthController.resendVerificationEmail)
router.post("/forget-password", authRateLimiter, AuthController.forgetPassword)
router.post("/reset-password", authRateLimiter, AuthController.resetPassword)

router.get("/login/google", AuthController.googleLogin);
router.get("/google/success", AuthController.googleLoginSuccess);
router.get("/oauth/error", AuthController.handleOAuthError);

export const AuthRoutes = router;
