import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SubscriptionService } from "./subscription.service";

const initiatePayment = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await SubscriptionService.initiatePayment(user, req.body);

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

const handleIpn = catchAsync(
    async (req: Request, res: Response) => {
        const result = await SubscriptionService.handleIpn(req.body);
        if (result.redirectUrl) {
            res.redirect(result.redirectUrl);
        } else {
            sendResponse(res, {
                httpStatusCode: status.OK,
                success: true,
                message: result.message || "IPN processed",
                data: null,
            });
        }
    }
)

const getInvoice = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { subscriptionId } = req.params;
        const pdfBuffer = await SubscriptionService.getInvoice(user, subscriptionId as string);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="CareerBangla-Invoice-${subscriptionId}.pdf"`,
            "Content-Length": pdfBuffer.length,
        });
        res.send(pdfBuffer);
    }
)

export const SubscriptionController = {
    initiatePayment,
    handleIpn,
    cancelSubscription,
    getSubscriptionPlans,
    getMySubscriptions,
    getInvoice,
}
