import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import { xmppNodeProperties } from './properties';
import { xmppNodeExecute } from './execute';

export class Xmpp implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'XMPP',
        name: 'xmpp',
        icon: 'file:xmpp.png',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Interact with XMPP',
        defaults: { name: 'XMPP' },
        codex: {
            categories: ['Communication'],
            subcategories: { Communication: ['XMPP'] },
            alias: ['XMPP'],
        },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [
            {
                name: 'xmppApi',
                required: true,
                displayName: 'Connection XMPP'
            },
            {
                name: 'rabbitMqApi',
                required: true,
                displayName: 'Connection RabbitMq'
            }
        ],
        // A estrutura de propriedades do nó:
        // • Resources: Recursos disponíveis (Instancia, Mensagens, Eventos, Integrações)
        // • Operations: Operações de cada recurso (Ex: Criar instancia, Enviar mensagem, Definir Webhook)
        // • Fields: Campos de cada operação
        properties: xmppNodeProperties
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const resource = this.getNodeParameter('resource', 0) as string;
        const operation = this.getNodeParameter('operation', 0) as string;

        const fn = xmppNodeExecute?.[resource]?.[operation];
        if (!fn) {
            throw new NodeOperationError(this.getNode(), `Operation not supported: ${resource}/${operation}`);
        }

        const item = await fn(this);
        return [[item]];
    }
}