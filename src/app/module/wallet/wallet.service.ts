import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getMyWallet = async (user: IRequestUser) => {
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.userId },
        include: {
            transactions: {
                orderBy: { createdAt: "desc" },
            }
        }
    })

    if (!wallet) {
        // Create wallet if it doesn't exist
        const newWallet = await prisma.wallet.create({
            data: {
                userId: user.userId,
                balance: 0,
            },
            include: {
                transactions: true,
            }
        })
        return newWallet;
    }

    return wallet;
}

const getTransactionHistory = async (user: IRequestUser) => {
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.userId }
    })

    if (!wallet) {
        throw new AppError(status.NOT_FOUND, "Wallet not found");
    }

    const transactions = await prisma.coinTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
    })

    return transactions;
}

export const WalletService = {
    getMyWallet,
    getTransactionHistory,
}
