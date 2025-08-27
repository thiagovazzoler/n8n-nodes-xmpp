import { IExecuteFunctions } from 'n8n-workflow';
import { sendMessage } from './sendMessage';
import { sendFile } from './sendFile';

type ResourceOperationExecute = {
  [resource: string]: {
    [operation: string]: (ef: IExecuteFunctions) => Promise<any>;
  };
};

export const xmppNodeExecute: ResourceOperationExecute = {
  'xmpp-message': {
    'xmpp-sendmessage': sendMessage,
  },
  'xmpp-file': {
    'xmpp-sendfile': sendFile,
  },
};
