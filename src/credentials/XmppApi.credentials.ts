import {
  IAuthenticateGeneric,
  ICredentialType,
  ICredentialDataDecryptedObject,
  INodeProperties,
  ICredentialTestFunctions,
  ICredentialTestRequest,
  INodeCredentialTestResult,
} from 'n8n-workflow';

import { client } from '@xmpp/client';

export class XmppApi implements ICredentialType {
  name = 'xmppApi';
  displayName = 'XMPP Credential';
  documentationUrl = ''; // opcional  
  properties: INodeProperties[] = [
    {
      displayName: 'XMPP Service',
      name: 'service',
      type: 'string',
      default: '',
      required: true,
      description: 'XMPP Service Address (ex: ws://your_address)'
    },
    {
      displayName: 'XMPP Domain',
      name: 'domain',
      type: 'string',
      default: '',
      required: true,
      description: 'XMPP Service Domain'
    },
    {
      displayName: 'JID User',
      name: 'jid',
      type: 'string',
      default: '',
      required: true,
      description: 'JID to connect to the XMPP server',
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'JID user authentication password',
    },
  ];
}

module.exports = { XmppApi };