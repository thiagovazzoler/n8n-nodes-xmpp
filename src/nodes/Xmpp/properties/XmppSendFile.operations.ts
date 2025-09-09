import { INodeProperties } from 'n8n-workflow';

export const XmppSendFileOperationsOptions: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
        show: {
            resource: ['xmpp-file'], 
        },
    },
    // Opções que serão vinculadas a Operação "Instancia"
    options: [
        {
            // Create Instance Basic
            name: 'Send file',
            action: 'Send file',
            description: 'Send a file to the RabbitMq processing queue to be sent to XmppTrigger',
            value: 'xmpp-sendfile',
        }
    ],
    // Definindo como padrão a opção "Criar Instancia"
    default: 'xmpp-sendfile',
};
