/**
 * Check if a user has active premium access.
 * Lifetime users have isPremium=true and premiumUntil=null.
 * Time-limited users have isPremium=true and premiumUntil > now.
 */
export const hasActivePremium = (user: { isPremium: boolean; premiumUntil: Date | null }): boolean => {
    return user.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > new Date());
};
