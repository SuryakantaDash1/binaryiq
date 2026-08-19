-- Module 08: Support Tickets + Chatbot

-- CreateEnum
CREATE TYPE "TicketIssueType" AS ENUM ('LOGIN', 'SURVEY', 'SURVEY_PAYMENT', 'REWARDS', 'UNSUBSCRIBE', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateTable support_tickets
CREATE TABLE "support_tickets" (
    "id"                UUID                NOT NULL DEFAULT gen_random_uuid(),
    "user_id"           UUID                NOT NULL,
    "issue_type"        "TicketIssueType"   NOT NULL,
    "subject"           TEXT,
    "status"            "TicketStatus"      NOT NULL DEFAULT 'OPEN',
    "assignee_admin_id" UUID,
    "created_at"        TIMESTAMPTZ(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ(6)      NOT NULL,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable support_ticket_messages
CREATE TABLE "support_ticket_messages" (
    "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id"   UUID            NOT NULL,
    "sender_type" TEXT            NOT NULL,
    "message"     TEXT            NOT NULL,
    "metadata"    JSONB,
    "created_at"  TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_user_id_created_at_idx" ON "support_tickets"("user_id", "created_at");
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey"
    FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
