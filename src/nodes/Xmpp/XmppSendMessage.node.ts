import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import { client } from '@xmpp/client';
import xml from '@xmpp/xml';
import XmppClientSingleton from './XmppClientSingleton';

export class XmppSendMessage implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'XMPP Send Message',
        name: 'xmppSendMessage',
        icon: 'file:xmpp.png',
        group: ['transform'],
        version: 1,
        description: 'Send messages to an XMPP user via Openfire',
        defaults: {
            name: 'XMPP Send Message',
        },
        inputs: ['main'],
        outputs: ['main'],
        codex: {
            categories: ['XMPP']
        },
        credentials: [
            {
                name: 'xmppApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'To (JID)',
                name: 'to',
                type: 'string',
                default: '',
                placeholder: 'ex: user@your_domain',
                description: 'Message recipient',
                required: true,
            },
            {
                displayName: 'Message',
                name: 'message',
                type: 'string',
                default: '',
                required: true,
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        try {
            const items = this.getInputData();
            const returnData: INodeExecutionData[] = [];

            const credentials = await this.getCredentials('xmppApi');
            const { service, domain, jid, password } = credentials;

            const xmppClient = await XmppClientSingleton.getInstance({
                service: service.toString(),
                domain: domain.toString(),
                username: jid.toString(),
                password: password.toString(),
            });

            await new Promise<void>((resolve, reject) => {
                let sent = false;

                try {
                    if (sent)
                        return;

                    sent = true;

                    for (let i = 0; i < items.length; i++) {
                        const to = this.getNodeParameter('to', i) as string;
                        const message = this.getNodeParameter('message', i) as string;

                        const messageStanza = xml(
                            'message',
                            { type: 'chat', to },
                            xml('body', {}, message),
                        );

                        xmppClient.send(messageStanza);

                        returnData.push({
                            json: {
                                status: true,
                                data: {
                                    message: 'sent'
                                }
                            },
                        });
                    }
                    resolve();
                }
                catch (error) {
                    reject(new Error((error as Error).message));
                }
            });

            return [returnData];
        }
        catch (error) {
            throw new NodeOperationError(this.getNode(), (error as Error).message);
        }
    }
}
