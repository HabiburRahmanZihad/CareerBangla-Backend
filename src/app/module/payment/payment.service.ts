import Stripe from "stripe";
import { SubscriptionService } from "../subscription/subscription.service";

const handlerStripeWebhookEvent = async (event: Stripe.Event) => {
    return SubscriptionService.handleStripeWebhookEvent(event);
}

export const PaymentService = {
    handlerStripeWebhookEvent
}
