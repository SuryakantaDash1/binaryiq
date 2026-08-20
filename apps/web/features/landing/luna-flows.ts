// Self-contained Q&A flows for the public landing chatbot (mirrors the backend
// support flows so the marketing bot works with no API).

export type LunaFlowNode = {
  id: string;
  message: string;
  options?: { label: string; next: string }[];
  resolution?: boolean;
  escalate?: boolean;
  action?: { type: 'navigate'; href: string };
  suppressEscalation?: boolean;
};

export type LunaFlow = {
  topic: string;
  issueType: string;
  title: string;
  entryNodeId: string;
  nodes: Record<string, LunaFlowNode>;
};

export const LUNA_FLOWS: LunaFlow[] = [
  {
    topic: 'LOGIN',
    issueType: 'LOGIN',
    title: 'Login Problems',
    entryNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        message: "I can help with login issues. What's happening?",
        options: [
          { label: 'I forgot my password', next: 'forgot_password' },
          { label: 'My account is locked', next: 'account_locked' },
          { label: "I'm not receiving the verification email", next: 'no_verify_email' },
        ],
      },
      forgot_password: {
        id: 'forgot_password',
        message:
          "You can reset your password by clicking 'Forgot Password' on the login page. A reset link will be sent to your registered email address within a few minutes.",
        resolution: true,
      },
      account_locked: {
        id: 'account_locked',
        message:
          'Accounts are temporarily locked after 5 failed login attempts. The lock lifts automatically after 15 minutes. If you are still locked out after that, raise a ticket and our team will help.',
        escalate: true,
      },
      no_verify_email: {
        id: 'no_verify_email',
        message:
          'Verification emails can take up to 5 minutes. Please check your spam/junk folder. You can also request a new one from the login page.',
        resolution: true,
      },
    },
  },
  {
    topic: 'SURVEY',
    issueType: 'SURVEY',
    title: 'Survey Problems',
    entryNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        message: 'What survey issue are you experiencing?',
        options: [
          { label: 'Survey not loading', next: 'not_loading' },
          { label: 'Survey terminated mid-way', next: 'terminated' },
          { label: 'I am not matched to any surveys', next: 'no_match' },
        ],
      },
      not_loading: {
        id: 'not_loading',
        message:
          'Survey loading issues are often caused by browser extensions or ad-blockers. Try disabling these and reloading. If the problem persists, please raise a ticket.',
        escalate: true,
      },
      terminated: {
        id: 'terminated',
        message:
          'Surveys can terminate early if your profile does not match the target criteria mid-survey — this is normal and not an error. Points are not awarded for screened-out surveys. If you believe this was an error, raise a ticket.',
        escalate: true,
      },
      no_match: {
        id: 'no_match',
        message:
          'Survey matching depends on your profile completion. Go to Profile → About You and fill in all sections to unlock more surveys. New surveys are added regularly.',
        resolution: true,
      },
    },
  },
  {
    topic: 'SURVEY_PAYMENT',
    issueType: 'SURVEY_PAYMENT',
    title: 'Survey Payment',
    entryNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        message: 'What is the problem with your survey reward?',
        options: [
          { label: 'Points not credited after completion', next: 'not_credited' },
          { label: 'Wrong amount credited', next: 'wrong_amount' },
        ],
      },
      not_credited: {
        id: 'not_credited',
        message:
          'Rewards can take up to 24 hours to post after a survey completes. If it has been longer than 24 hours, please raise a ticket and we will look into it.',
        escalate: true,
      },
      wrong_amount: {
        id: 'wrong_amount',
        message:
          'The points shown before you start a survey are the guaranteed amount. If the credit differs, raise a ticket and we will reconcile it.',
        escalate: true,
      },
    },
  },
  {
    topic: 'REWARDS',
    issueType: 'REWARDS',
    title: 'Rewards Delivery',
    entryNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        message: 'What is the issue with your reward?',
        options: [
          { label: 'My redemption is pending for too long', next: 'pending_long' },
          { label: 'I received the wrong reward', next: 'wrong_reward' },
          { label: 'My PayPal payment did not arrive', next: 'paypal_missing' },
        ],
      },
      pending_long: {
        id: 'pending_long',
        message:
          'Reward processing normally takes 3-5 business days. For charity and PayPal transfers, it can be up to 10 days. If your redemption has been pending for longer, raise a ticket.',
        escalate: true,
      },
      wrong_reward: {
        id: 'wrong_reward',
        message:
          'If you received the wrong reward, please raise a ticket immediately and we will correct it. Please include your redemption reference number.',
        escalate: true,
      },
      paypal_missing: {
        id: 'paypal_missing',
        message:
          'PayPal transfers can take 3-5 business days after we process the payout. Check that your PayPal account email matches what you registered. If it has been more than 7 days, raise a ticket.',
        escalate: true,
      },
    },
  },
  {
    topic: 'UNSUBSCRIBE',
    issueType: 'UNSUBSCRIBE',
    title: 'Unsubscribe',
    entryNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        message: 'I can help with subscription and account options. What would you like to do?',
        options: [
          { label: 'Manage notification preferences', next: 'manage_notifs' },
          { label: 'Delete my account', next: 'delete_account' },
        ],
      },
      manage_notifs: {
        id: 'manage_notifs',
        message:
          'You can manage all your notification preferences from your account settings once you are signed in.',
        escalate: true,
      },
      delete_account: {
        id: 'delete_account',
        message:
          'To request account deletion, sign in and go to Account → Privacy. Your data will be handled as per our Privacy Policy and applicable data protection law.',
        escalate: true,
      },
    },
  },
];
