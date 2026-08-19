import {
  postTicketMessageSchema,
  type PostTicketMessageInput,
  updateTicketSchema,
  type UpdateTicketInput,
} from '@influencer/types';
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { SupportService } from './support.service';

const adminListQuery = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  issueType: z.enum(['LOGIN', 'SURVEY', 'SURVEY_PAYMENT', 'REWARDS', 'UNSUBSCRIBE', 'OTHER']).optional(),
  assigneeId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

@Controller('admin/support')
@Roles('SUPPORT', 'ADMIN', 'SUPER_ADMIN', 'DPO')
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  adminListTickets(
    @Query(new ZodValidationPipe(adminListQuery))
    q: {
      status?: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
      issueType?: 'LOGIN' | 'SURVEY' | 'SURVEY_PAYMENT' | 'REWARDS' | 'UNSUBSCRIBE' | 'OTHER';
      assigneeId?: string;
      userId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    return this.supportService.adminListTickets(q);
  }

  @Get('tickets/:id')
  adminGetTicket(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.supportService.adminGetTicket(user.id, id);
  }

  @Put('tickets/:id')
  adminUpdateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTicketSchema)) body: UpdateTicketInput,
  ) {
    return this.supportService.adminUpdateTicket(user.id, id, body);
  }

  @Post('tickets/:id/messages')
  @HttpCode(201)
  adminAddMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(postTicketMessageSchema)) body: PostTicketMessageInput,
  ) {
    return this.supportService.adminAddMessage(user.id, id, body);
  }
}
