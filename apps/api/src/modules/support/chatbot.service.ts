import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ChatbotFlow, TicketIssueType } from '@influencer/types';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';


import { NotFoundException } from '../../common/exceptions/domain.exception';

function loadFlow(filename: string): ChatbotFlow {
  const filePath = join(__dirname, 'flows', filename);
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ChatbotFlow;
}

const ALL_FLOWS: ChatbotFlow[] = [
  loadFlow('login.json'),
  loadFlow('survey.json'),
  loadFlow('survey_payment.json'),
  loadFlow('rewards.json'),
  loadFlow('unsubscribe.json'),
];

@Injectable()
export class ChatbotService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly flowMap = new Map<string, ChatbotFlow>();

  onModuleInit(): void {
    for (const flow of ALL_FLOWS) {
      this.flowMap.set(flow.topic, flow);
    }
    this.logger.log(`Loaded ${this.flowMap.size} chatbot flows`);
  }

  listFlows(): ChatbotFlow[] {
    return ALL_FLOWS;
  }

  getFlow(topic: string): ChatbotFlow {
    const flow = this.flowMap.get(topic.toUpperCase());
    if (!flow) throw new NotFoundException(`Unknown topic: ${topic}`);
    return flow;
  }

  resolveIssueType(topic: string): TicketIssueType {
    return this.getFlow(topic).issueType;
  }
}
