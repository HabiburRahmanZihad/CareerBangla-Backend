import { Request, Response } from "express";
import status from "http-status";
import { envVars } from "../../config/env";
import { stripe } from "../../config/stripe.config";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PaymentService } from "./payment.service";

const handleStripeWebhookEvent = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = envVars.STRIPE.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        return res.status(status.BAD_REQUEST).json({ message: "Missing Stripe signature or webhook secret" });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch {
        return res.status(status.BAD_REQUEST).json({ message: "Invalid Stripe webhook signature" });
    }

    try {
        const result = await PaymentService.handlerStripeWebhookEvent(event);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Stripe webhook event processed successfully",
            data: result
        })
    } catch {
        sendResponse(res, {
            httpStatusCode: status.INTERNAL_SERVER_ERROR,
            success: false,
            message: "Error handling Stripe webhook event"
        })
    }
})

export const PaymentController = {
    handleStripeWebhookEvent
}
