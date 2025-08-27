import { IExecuteFunctions } from 'n8n-workflow';
import { sendMessage } from './sendMessage';
import { sendFile } from './sendFile';

type ResourceOperationFunctions = {
  [resource: string]: {
    [operation: string]: (ef: IExecuteFunctions) => Promise<any>;
  };
};

export const resourceOperationsFunctions: ResourceOperationFunctions = {
  'xmpp-message': {
    'xmpp-sendmessage': sendMessage,
  },
  'xmpp-file': {
    'xmpp-sendfile': sendFile,
  },
};
