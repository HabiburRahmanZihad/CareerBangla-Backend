import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
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
        });
    }
);

const getWalletTransactions = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await WalletService.getWalletTransactions(user, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Wallet transactions fetched successfully",
            data: result.data,
            meta: result.meta,
        });
    }
);

export const WalletController = {
    getMyWallet,
    getWalletTransactions,
};
