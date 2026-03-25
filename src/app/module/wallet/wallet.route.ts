import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { WalletController } from "./wallet.controller";

const router = Router();

router.get("/",
    checkAuth(Role.RECRUITER, Role.USER),
    WalletController.getMyWallet);

router.get("/transactions",
    checkAuth(Role.RECRUITER, Role.USER),
    WalletController.getWalletTransactions);

export const WalletRoutes = router;
