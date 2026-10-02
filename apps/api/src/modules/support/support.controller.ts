import {
  createTicketSchema,
  type CreateTicketInput,
  postTicketMessageSchema,
  type PostTicketMessageInput,
} from '@influencer/types';
import { Body, Controller, Get, HttpCode, Ip, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { SupportService } from './support.service';

const listTicketsQuery = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @HttpCode(201)
  createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTicketSchema)) body: CreateTicketInput,
    @Ip() ip: string,
  ) {
    return this.supportService.createTicket(user.id, body, ip);
  }

  @Get('tickets')
  listTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listTicketsQuery))
    q: { status?: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'; limit?: number; cursor?: string },
  ) {
    return this.supportService.listTickets(user.id, q);
  }

  @Get('tickets/:id')
  getTicket(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.supportService.getTicket(user.id, id);
  }

  @Post('tickets/:id/messages')
  @HttpCode(201)
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(postTicketMessageSchema)) body: PostTicketMessageInput,
  ) {
    return this.supportService.addMessage(user.id, id, body);
  }
}
