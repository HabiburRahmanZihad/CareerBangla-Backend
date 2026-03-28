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

const getAllPaymentSubscriptions = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { page = "1", limit = "10", status: statusFilter, plan, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

        const result = await SubscriptionService.getAllPaymentSubscriptions(user, {
            page: parseInt(page as string, 10),
            limit: parseInt(limit as string, 10),
            status: statusFilter as string | undefined,
            plan: plan as string | undefined,
            search: search as string | undefined,
            sortBy: sortBy as string,
            sortOrder: sortOrder as "asc" | "desc",
        });

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All payment subscriptions fetched successfully",
            data: result,
        })
    }
)

const getPaymentSubscriptionById = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { subscriptionId } = req.params;
        const result = await SubscriptionService.getPaymentSubscriptionById(user, subscriptionId as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Payment subscription details fetched successfully",
            data: result,
        })
    }
)

export const SubscriptionController = {
    initiatePayment,
    handleIpn,
    cancelSubscription,
    getSubscriptionPlans,
    getMySubscriptions,
    getInvoice,
    getAllPaymentSubscriptions,
    getPaymentSubscriptionById,
}
