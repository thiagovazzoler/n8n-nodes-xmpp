import { INodeProperties } from 'n8n-workflow';

import { XmppSendFileFields } from './XmppSendFile.fields';
import { XmppSendFileOperationsOptions } from './XmppSendFile.operations';

import { XmppSendMessageFields } from './XmppSendMessage.fields';
import { XmppSendMessageOperationsOptions } from './XmppSendMessage.operations';

const resourcesOptions: INodeProperties = {
  displayName: 'Recurso',
  name: 'resource',
  type: 'options',
  noDataExpression: true,
  options: [
    { name: 'Mensagem', value: 'xmpp-message' },
    { name: 'Arquivo', value: 'xmpp-file' },
  ],
  // ⚠️ o default anterior era 'xmpp-resource' (inválido).
  default: 'xmpp-message',
};

export const xmppNodeProperties = [
  // --- RESOURCE SWITCH ---
  resourcesOptions,

  // --- MESSAGE ---
  XmppSendMessageOperationsOptions,
  ...XmppSendMessageFields,

  // --- FILE ---
  XmppSendFileOperationsOptions,
  ...XmppSendFileFields
];
