import { Controller, Get, Param } from '@nestjs/common';

import { ChatbotService } from './chatbot.service';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('flows')
  listFlows() {
    return { data: this.chatbotService.listFlows() };
  }

  @Get('flows/:topic')
  getFlow(@Param('topic') topic: string) {
    return { data: this.chatbotService.getFlow(topic) };
  }
}
