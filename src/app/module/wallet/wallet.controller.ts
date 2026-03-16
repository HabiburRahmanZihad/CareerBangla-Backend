import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { WalletService } from "./wallet.service";

const getMyWallet = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await WalletService.getMyWallet(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Wallet fetched successfully",
            data: result,
        })
    }
)

const getTransactionHistory = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await WalletService.getTransactionHistory(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Transaction history fetched successfully",
            data: result,
        })
    }
)

export const WalletController = {
    getMyWallet,
    getTransactionHistory,
}
