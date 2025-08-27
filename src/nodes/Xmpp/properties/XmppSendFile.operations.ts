import { INodeProperties } from 'n8n-workflow';

export const XmppSendFileOperationsOptions: INodeProperties = {
    displayName: 'Operação',
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
            name: 'Enviar arquivo',
            action: 'Enviar arquivo',
            description: 'Enviar um arquivo',
            value: 'xmpp-sendfile',
        }
    ],
    // Definindo como padrão a opção "Criar Instancia"
    default: 'xmpp-sendfile',
};
