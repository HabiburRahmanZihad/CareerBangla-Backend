import status from "http-status";
import { PaymentStatus, Role } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getDashboardStatsData = async (user: IRequestUser) => {
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

const getSuperAdminStatsData = async () => {
    const jobCount = await prisma.job.count({ where: { isDeleted: false } });
    const applicationCount = await prisma.application.count();
    const recruiterCount = await prisma.recruiter.count({ where: { isDeleted: false } });
    const userCount = await prisma.user.count();
    const adminCount = await prisma.admin.count();
    const activeJobCount = await prisma.job.count({ where: { status: "ACTIVE", isDeleted: false } });

    const totalRevenue = await prisma.subscription.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.PAID }
    });

    const pieChartData = await getApplicationStatusDistribution();
    const barChartData = await getApplicationsByMonth();

    return {
        jobCount,
        applicationCount,
        recruiterCount,
        userCount,
        adminCount,
        activeJobCount,
        totalRevenue: totalRevenue._sum.amount || 0,
        pieChartData,
        barChartData
    }
}

const getAdminStatsData = async () => {
    const jobCount = await prisma.job.count({ where: { isDeleted: false } });
    const applicationCount = await prisma.application.count();
    const recruiterCount = await prisma.recruiter.count({ where: { isDeleted: false } });
    const userCount = await prisma.user.count();
    const activeJobCount = await prisma.job.count({ where: { status: "ACTIVE", isDeleted: false } });
    const pendingRecruiters = await prisma.recruiter.count({ where: { status: "PENDING" } });

    const totalRevenue = await prisma.subscription.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.PAID }
    });

    const pieChartData = await getApplicationStatusDistribution();
    const barChartData = await getApplicationsByMonth();

    return {
        jobCount,
        applicationCount,
        recruiterCount,
        userCount,
        activeJobCount,
        pendingRecruiters,
        totalRevenue: totalRevenue._sum.amount || 0,
        pieChartData,
        barChartData
    }
}

const getRecruiterStatsData = async (user: IRequestUser) => {
    const recruiterData = await prisma.recruiter.findUniqueOrThrow({
        where: { userId: user.userId }
    });

    const jobCount = await prisma.job.count({
        where: { recruiterId: recruiterData.id, isDeleted: false }
    })

    const applicationCount = await prisma.application.count({
        where: { job: { recruiterId: recruiterData.id } }
    })

    const activeJobCount = await prisma.job.count({
        where: { recruiterId: recruiterData.id, status: "ACTIVE", isDeleted: false }
    })

    const uniqueApplicants = await prisma.application.groupBy({
        by: ["userId"],
        where: { job: { recruiterId: recruiterData.id } },
        _count: { id: true }
    })

    const applicationStatusDistribution = await prisma.application.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { job: { recruiterId: recruiterData.id } }
    })

    const formattedStatusDistribution = applicationStatusDistribution.map(({ _count, status }) => ({
        status,
        count: _count.id
    }))

    return {
        jobCount,
        applicationCount,
        activeJobCount,
        uniqueApplicants: uniqueApplicants.length,
        applicationStatusDistribution: formattedStatusDistribution
    }
}

const getUserStatsData = async (user: IRequestUser) => {
    const applicationCount = await prisma.application.count({
        where: { userId: user.userId }
    })

    const applicationStatusDistribution = await prisma.application.groupBy({
        by: ["status"],
        _count: { id: true },
        where: { userId: user.userId }
    })

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
