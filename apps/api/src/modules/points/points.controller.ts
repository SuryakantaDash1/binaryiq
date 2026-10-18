import { transactionQuerySchema, type TransactionQuery } from '@binaryiq/types';
import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { PointsService } from './points.service';

interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  isAdmin: boolean;
}

@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get('balance')
  getBalance(@CurrentUser() user: AuthUser) {
    return this.points.getBalance(user.id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(transactionQuerySchema)) query: TransactionQuery,
  ) {
    return this.points.getTransactions(user.id, query);
  }
}
