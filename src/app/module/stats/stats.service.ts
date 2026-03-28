import status from "http-status";
import { PaymentStatus, Role } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

const getDashboardStatsData = async (user: IRequestUser) => {
    logger.read(`Fetching dashboard stats → role: ${user.role}, userId: ${user.userId}`);
    let statsData;

    switch (user.role) {
        case Role.SUPER_ADMIN:
            statsData = getSuperAdminStatsData();
            break;
        case Role.ADMIN:
            statsData = getAdminStatsData();
            break;
        case Role.RECRUITER:
            statsData = getRecruiterStatsData(user);
            break;
        case Role.USER:
            statsData = getUserStatsData(user);
            break;
        default:
            throw new AppError(status.BAD_REQUEST, "Invalid user role");
    }

    return statsData;
}

const getCommonStatsData = async () => {
    const [
        jobCount,
        applicationCount,
        recruiterCount,
        userCount,
        activeJobCount,
        totalRevenue,
        pieChartData,
        barChartData
    ] = await Promise.all([
        prisma.job.count({ where: { isDeleted: false } }),
        prisma.application.count(),
        prisma.recruiter.count({ where: { isDeleted: false } }),
        prisma.user.count(),
        prisma.job.count({ where: { status: "LIVE", isDeleted: false } }),
        prisma.subscription.aggregate({
            _sum: { amount: true },
            where: { status: PaymentStatus.PAID }
        }),
        getApplicationStatusDistribution(),
        getApplicationsByMonth()
    ]);

    return {
        jobCount,
        applicationCount,
        recruiterCount,
        userCount,
        activeJobCount,
        totalRevenue: totalRevenue._sum.amount || 0,
        pieChartData,
        barChartData
    };
}

const getSuperAdminStatsData = async () => {
    const [commonStats, adminCount] = await Promise.all([
        getCommonStatsData(),
        prisma.admin.count()
    ]);

    return {
        ...commonStats,
        adminCount
    };
}

const getAdminStatsData = async () => {
    const [commonStats, pendingRecruiters, adminCount] = await Promise.all([
        getCommonStatsData(),
        prisma.recruiter.count({ where: { status: "PENDING" } }),
        prisma.admin.count()
    ]);

    return {
        ...commonStats,
        pendingRecruiters,
        adminCount,
    };
}

const getRecruiterStatsData = async (user: IRequestUser) => {
    const recruiterData = await prisma.recruiter.findUniqueOrThrow({
        where: { userId: user.userId }
    });

    const [
        jobCount,
        applicationCount,
        activeJobCount,
        uniqueApplicants,
        applicationStatusDistribution,
        jobsByStatus,
        applicationsByMonth
    ] = await Promise.all([
        prisma.job.count({
            where: { recruiterId: recruiterData.id, isDeleted: false }
        }),
        prisma.application.count({
            where: { job: { recruiterId: recruiterData.id } }
        }),
        prisma.job.count({
            where: { recruiterId: recruiterData.id, status: "LIVE", isDeleted: false }
        }),
        prisma.application.groupBy({
            by: ["userId"],
            where: { job: { recruiterId: recruiterData.id } },
            _count: { id: true }
        }),
        prisma.application.groupBy({
            by: ["status"],
            _count: { id: true },
            where: { job: { recruiterId: recruiterData.id } }
        }),
        prisma.job.groupBy({
            by: ["status"],
            _count: { id: true },
            where: { recruiterId: recruiterData.id, isDeleted: false }
        }),
        prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
            SELECT DATE_TRUNC('month', a."createdAt") AS month,
            CAST(COUNT(*) AS INTEGER) AS count
            FROM "application" a
            INNER JOIN "job" j ON a."jobId" = j."id"
            WHERE j."recruiterId" = ${recruiterData.id}
            GROUP BY month
            ORDER BY month ASC
        `
    ]);

    const formattedStatusDistribution = applicationStatusDistribution.map(({ _count, status }) => ({
        status,
        count: _count.id
    }));

    const formattedJobsByStatus = jobsByStatus.map(({ _count, status }) => ({
        status,
        count: _count.id
    }));

    return {
        jobCount,
        applicationCount,
        activeJobCount,
        uniqueApplicants: uniqueApplicants.length,
        applicationStatusDistribution: formattedStatusDistribution,
        jobsByStatus: formattedJobsByStatus,
        applicationsByMonth
    }
}

const getUserStatsData = async (user: IRequestUser) => {
    const [applicationCount, applicationStatusDistribution] = await Promise.all([
        prisma.application.count({
            where: { userId: user.userId }
        }),
        prisma.application.groupBy({
            by: ["status"],
            _count: { id: true },
            where: { userId: user.userId }
        })
    ]);

    const formattedStatusDistribution = applicationStatusDistribution.map(({ _count, status }) => ({
        status,
        count: _count.id
    }))

    return {
        applicationCount,
        applicationStatusDistribution: formattedStatusDistribution
    }
}

const getApplicationStatusDistribution = async () => {
    const statusDistribution = await prisma.application.groupBy({
        by: ["status"],
        _count: { id: true }
    });

    return statusDistribution.map(({ _count, status }) => ({
        status,
        count: _count.id
    }))
}

const getApplicationsByMonth = async () => {
    interface ApplicationCountByMonth {
        month: Date;
        count: bigint;
    }
    const applicationCountByMonth: ApplicationCountByMonth[] = await prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "createdAt") AS month,
        CAST(COUNT(*) AS INTEGER) AS count
        FROM "application"
        GROUP BY month
        ORDER BY month ASC;
    `

    return applicationCountByMonth
}


export const StatsService = {
    getDashboardStatsData
}
