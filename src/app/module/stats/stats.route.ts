import express from 'express';
import { Role } from '../../../generated/prisma/enums';
import { checkAuth } from '../../middleware/checkAuth';
import { StatsController } from './stats.controller';

const router = express.Router();

router.get(
    '/',
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.RECRUITER, Role.USER),
    StatsController.getDashboardStatsData
)


export const StatsRoutes = router;
