import { INodeProperties, NodePropertyTypes } from 'n8n-workflow';

export const XmppSendFileFields: INodeProperties[] = [
    {
        displayName: 'To (JID)',
        name: 'to',
        type: 'string',
        default: '',
        placeholder: 'ex: user@domain',
        required: true,
        displayOptions: {
            show: { resource: ['xmpp-file'], operation: ['xmpp-sendfile'] },
        },
    },
    {
        displayName: 'File (Base64)',
        name: 'fileBase64',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
            show: { resource: ['xmpp-file'], operation: ['xmpp-sendfile'] },
        },
    },
    {
        displayName: 'File Name',
        name: 'fileName',
        type: 'string',
        default: 'file.pdf',
        displayOptions: {
            show: { resource: ['xmpp-file'], operation: ['xmpp-sendfile'] },
        },
    },
];