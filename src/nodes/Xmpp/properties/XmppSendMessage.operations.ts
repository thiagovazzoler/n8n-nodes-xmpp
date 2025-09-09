import { INodeProperties } from 'n8n-workflow';

export const XmppSendMessageOperationsOptions: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: { resource: ['xmpp-message'] },
  },
  options: [
    {
      name: 'Send message',
      action: 'Send message',
      description: 'Send text message (chat) to RabbitMq processing queue to be sent to XmppTrigger',
      value: 'xmpp-sendmessage',
    },
  ],
  default: 'xmpp-sendmessage',
};
