import { INodeProperties } from 'n8n-workflow';

export const XmppSendMessageFields: INodeProperties[] = [
  {
    displayName: 'To (JID)',
    name: 'to',
    type: 'string',
    default: '',
    placeholder: 'ex: user@domain',
    required: true,
    displayOptions: {
      show: { resource: ['xmpp-message'], operation: ['xmpp-sendmessage'] },
    },
  },
  {
    displayName: 'Message',
    name: 'message',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: { resource: ['xmpp-message'], operation: ['xmpp-sendmessage'] },
    },
  },
];
