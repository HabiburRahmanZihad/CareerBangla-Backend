import status from "http-status";
import { TransactionPurpose, TransactionType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { QueryBuilder } from "../../utils/QueryBuilder";

const getMyWallet = async (user: IRequestUser) => {
    logger.read(`Fetching wallet → userId: ${user.userId}`);
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.userId },
        include: {
            transactions: {
                orderBy: { createdAt: "desc" },
                take: 20,
            },
        },
    });

    if (!wallet) {
        throw new AppError(status.NOT_FOUND, "Wallet not found");
    }

    return wallet;
};

const getWalletTransactions = async (user: IRequestUser, query: IQueryParams) => {
    logger.read(`Fetching wallet transactions → userId: ${user.userId}`, { filters: query });
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.userId },
    });

    if (!wallet) {
        throw new AppError(status.NOT_FOUND, "Wallet not found");
    }

    const queryBuilder = new QueryBuilder(prisma.coinTransaction, query, {
        searchableFields: ["purpose", "message"],
        filterableFields: ["type", "purpose"],
    });

    const result = await queryBuilder
        .search()
        .filter()
        .where({ walletId: wallet.id })
        .paginate()
        .sort()
        .fields()
        .execute();

    return result;
};

/**
 * Deduct coins from a user's wallet
 * @throws AppError if insufficient balance
 */
const deductCoins = async (
    userId: string,
    amount: number,
    purpose: TransactionPurpose,
    message?: string
) => {
    logger.create(`Deducting coins → userId: ${userId}, amount: ${amount}, purpose: ${purpose}`);

    const wallet = await prisma.wallet.findUnique({
        where: { userId },
    });

    if (!wallet) {
        throw new AppError(status.NOT_FOUND, "Wallet not found");
    }

    if (wallet.coins < amount) {
        throw new AppError(
            status.BAD_REQUEST,
            `Insufficient coins. You have ${wallet.coins} coins but need ${amount} coins.`
        );
    }

    return await prisma.$transaction(async (tx) => {
        // Deduct coins
        const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
                coins: {
                    decrement: amount,
                },
            },
        });

        // Create transaction record
        await tx.coinTransaction.create({
            data: {
                type: TransactionType.DEBIT,
                purpose,
                amount,
                message,
                walletId: wallet.id,
            },
        });

        // Create notification
        await tx.notification.create({
            data: {
                userId,
                type: "COIN_DEBITED",
                title: `${amount} Coins Deducted`,
                message: `${amount} coins have been deducted from your account for ${purpose.toLowerCase().replace(/_/g, " ")}. You now have ${updatedWallet.coins} coins.`,
            },
        });

        logger.create(`Coins deducted successfully → wallet: ${wallet.id}, updatedBalance: ${updatedWallet.coins}`);
        return updatedWallet;
    });
};

/**
 * Credit coins to a user's wallet
 */
const creditCoins = async (
    userId: string,
    amount: number,
    purpose: TransactionPurpose,
    message?: string
) => {
    logger.create(`Crediting coins → userId: ${userId}, amount: ${amount}, purpose: ${purpose}`);

    const wallet = await prisma.wallet.findUnique({
        where: { userId },
    });

    if (!wallet) {
        throw new AppError(status.NOT_FOUND, "Wallet not found");
    }

    return await prisma.$transaction(async (tx) => {
        // Credit coins
        const updatedWallet = await tx.wallet.update({
            where: { id: wallet.id },
            data: {
                coins: {
                    increment: amount,
                },
            },
        });

        // Create transaction record
        await tx.coinTransaction.create({
            data: {
                type: TransactionType.CREDIT,
                purpose,
                amount,
                message,
                walletId: wallet.id,
            },
        });

        // Create notification
        await tx.notification.create({
            data: {
                userId,
                type: "COIN_CREDITED",
                title: `${amount} Coins Credited`,
                message: `${amount} coins have been credited to your account for ${purpose.toLowerCase().replace(/_/g, " ")}. You now have ${updatedWallet.coins} coins.`,
            },
        });

        logger.create(`Coins credited successfully → wallet: ${wallet.id}, updatedBalance: ${updatedWallet.coins}`);
        return updatedWallet;
    });
};

/**
 * Initialize wallet for a new user
 */
const initializeWallet = async (userId: string) => {
    logger.create(`Initializing wallet → userId: ${userId}`);

    const existingWallet = await prisma.wallet.findUnique({
        where: { userId },
    });

    if (existingWallet) {
        return existingWallet;
    }

    return await prisma.wallet.create({
        data: {
            userId,
            coins: 50, // Starting balance
        },
    });
};

export const WalletService = {
    getMyWallet,
    getWalletTransactions,
    deductCoins,
    creditCoins,
    initializeWallet,
};
