import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SubscriptionService } from "./subscription.service";

const purchaseSubscription = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { plan } = req.body;
        const result = await SubscriptionService.purchaseSubscription(user, plan);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Subscription checkout initiated",
            data: result,
        })
    }
)

const cancelSubscription = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { subscriptionId } = req.params;
        const result = await SubscriptionService.cancelSubscription(user, subscriptionId as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Subscription cancelled successfully",
            data: result,
        })
    }
)

const getSubscriptionPlans = catchAsync(
    async (req: Request, res: Response) => {
        const result = await SubscriptionService.getSubscriptionPlans();

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Subscription plans fetched successfully",
            data: result,
        })
    }
)

const getMySubscriptions = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await SubscriptionService.getMySubscriptions(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "My subscriptions fetched successfully",
            data: result,
        })
    }
)

export const SubscriptionController = {
    purchaseSubscription,
    cancelSubscription,
    getSubscriptionPlans,
    getMySubscriptions,
}
