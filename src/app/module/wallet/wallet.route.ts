import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { WalletController } from "./wallet.controller";

const router = Router();

router.get("/",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    WalletController.getMyWallet);

router.get("/transactions",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    WalletController.getTransactionHistory);

export const WalletRoutes = router;
