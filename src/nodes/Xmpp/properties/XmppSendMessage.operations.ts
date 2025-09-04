import { INodeProperties } from 'n8n-workflow';

export const XmppSendMessageOperationsOptions: INodeProperties = {
  displayName: 'Operação',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: { resource: ['xmpp-message'] },
  },
  options: [
    {
      name: 'Enviar mensagem',
      action: 'Enviar mensagem',
      description: 'Enviar mensagem de texto (chat) para a fila de processamento do XmppTrigger',
      value: 'xmpp-sendmessage',
    },
  ],
  default: 'xmpp-sendmessage',
};
